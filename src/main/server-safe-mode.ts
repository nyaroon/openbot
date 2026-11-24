import { createServer } from "node:http";
import { join } from "node:path";
import type { ServerSafeModeReason } from "@openbot/contracts/team-protocol/server-safe-mode-v1";
import { sourceText } from "@openbot/i18n/source";
import { createOpenBotLogger } from "@openbot/logging";
import { Effect, Exit, Schema, Scope } from "effect";
import { app, session } from "electron";
import { createCentralAuthManager } from "./account-service-access";
import { isFinalClientError } from "./central-auth-manager";
import { readSignalHomeChoice, SIGNAL_HOME_PREFERENCE_FILE } from "./host-signal-home";
import { listenLoopback } from "./listen-loopback";
import { toRemoteWorkflowError } from "./remote-service-effects";
import { configureApplicationProtocol } from "./session-configuration";
import { handleServerSafeModeRequest, refuseServerSafeModeUpgrade } from "./team-api/server-safe-mode-api";
import { TEAM_STORE_FILE, TeamStore } from "./team-store";
import { TeamWebRtcBridge } from "./team-webrtc-bridge";
import { TeamWebRtcHostGateway } from "./team-webrtc-host-gateway";

const logger = createOpenBotLogger("server-safe-mode");

class ServerSafeModeUnavailable extends Schema.TaggedError<ServerSafeModeUnavailable>()("ServerSafeModeUnavailable", {
  cause: Schema.Defect(),
}) {}

export interface ServerSafeModeOptions {
  userDataPath: string;
  reason: ServerSafeModeReason;
}

export interface ServerSafeMode {
  readonly stop: Effect.Effect<void>;
}

const unavailable = (cause: unknown) => new ServerSafeModeUnavailable({ cause });

export const startServerSafeMode = Effect.fn("ServerSafeMode.start")(function* (options: ServerSafeModeOptions) {
  const scope = yield* Scope.make();
  return yield* open(options).pipe(
    Scope.provide(scope),
    Effect.map((): ServerSafeMode => ({ stop: Scope.close(scope, Exit.void) })),
    Effect.onError(() => Scope.close(scope, Exit.void)),
  );
});

const open = Effect.fn("ServerSafeMode.open")(function* (options: ServerSafeModeOptions) {
  const store = new TeamStore(join(options.userDataPath, TEAM_STORE_FILE));
  yield* store.loadReadOnly();
  const identity = store.getIdentity();
  if (!identity) return yield* unavailable(new Error(sourceText("error.team.hostNotConfigured")));

  const server = createServer((request, response) =>
    handleServerSafeModeRequest(request, response, {
      reason: options.reason,
      authenticate: (token) => store.authenticate(token),
    }),
  );
  server.on("upgrade", (_request, socket) => refuseServerSafeModeUpgrade(socket));
  const localApiPort = yield* Effect.acquireRelease(
    Effect.tryPromise({
      try: () => listenLoopback(server, () => new Error("The safe mode API has no port.")),
      catch: unavailable,
    }),
    () =>
      Effect.callback<void>((resume) => {
        server.close(() => resume(Effect.void));
        server.closeAllConnections();
      }),
  );

  const centralAuth = yield* Effect.acquireRelease(
    Effect.sync(() => createCentralAuthManager()),
    (manager) => manager.dispose().pipe(Effect.ignore),
  );
  yield* centralAuth.initialize().pipe(Effect.mapError(unavailable));
  const preferredSignalHome = yield* readSignalHomeChoice(join(options.userDataPath, SIGNAL_HOME_PREFERENCE_FILE));
  const bootstrap = yield* centralAuth
    .issueRemoteHostTicket(identity.serverId, { preferredSignalHome })
    .pipe(Effect.mapError(unavailable));

  if (!session.defaultSession.protocol.isProtocolHandled("openbot-app")) configureApplicationProtocol();
  const developmentUrl = process.env.ELECTRON_RENDERER_URL;
  const bridge = yield* Effect.acquireRelease(
    Effect.sync(
      () =>
        new TeamWebRtcBridge({
          developmentUrl: developmentUrl ?? null,
          iceTransportPolicy:
            developmentUrl && process.env.OPENBOT_DEV_ICE_TRANSPORT_POLICY === "relay" ? "relay" : "all",
        }),
    ),
    (value) => value.stop().pipe(Effect.ignore),
  );
  const gateway = yield* Effect.acquireRelease(
    Effect.sync(
      () =>
        new TeamWebRtcHostGateway({
          bridge,
          store,
          appVersion: options.reason.appVersion,
          transferDirectory: join(app.getPath("temp"), "openbot-safe-mode-transfers"),
          renewSignal: (hostId, failedSignalUrl) =>
            centralAuth
              .issueRemoteHostTicket(
                hostId,
                failedSignalUrl === undefined ? { preferredSignalHome } : { failedSignalUrl, preferredSignalHome },
              )
              .pipe(toRemoteWorkflowError),
          renewalRefused: isFinalClientError,
          verifyClientTicket: (ticket) => centralAuth.verifyRemoteSessionTicket(ticket).pipe(toRemoteWorkflowError),
          onSignalRecoveryFailure: (_error, reason) => logger.warn(`The safe mode lost Signal: ${reason}.`),
        }),
    ),
    (value) => value.dispose().pipe(Effect.ignore),
  );
  yield* gateway
    .start({ hostId: identity.serverId, signalUrl: bootstrap.signalUrl, ticket: bootstrap.ticket, localApiPort })
    .pipe(Effect.mapError(unavailable));

  logger.info(`Safe mode is on (${options.reason.reason}). Members can read the reason.`);
});
