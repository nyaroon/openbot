import { env, waitUntil } from "cloudflare:workers";
import { FEEDBACK_REPOSITORY } from "@openbot/contracts/feedback";
import { isDynamicRecord, isString } from "@openbot/contracts/runtime-values";
import { Effect } from "effect";
import { type AccountAnalytics, createAccountAnalytics } from "./account-analytics";
import { AccountAttribution } from "./account-attribution";
import { AccountVault, AccountVaultError } from "./account-vault";
import { AccountVaultBlobs } from "./account-vault-blobs";
import { adminTokenMatches } from "./admin-token";
import { AgentMarketplace, AgentMarketplaceError } from "./agent-marketplace";
import { AgentTemplates } from "./agent-templates";
import { type FcmRelaySender, sharedFcmSender } from "./android-notification-relay";
import { ArtifactError, Artifacts } from "./artifacts";
import { AuthOperationError, AuthService, AuthServiceError } from "./auth-service";
import { browserSessionToken } from "./browser-api";
import type { ContactMessageServices } from "./contact-message";
import { D1AuthRepository } from "./d1-auth-repository";
import { DiscordAppError, DiscordAppService } from "./discord-app";
import { runApiEffect } from "./effect-runtime";
import {
  createContactMessageDelivery,
  createEmailCodeDelivery,
  createOwnerTransferEmailDelivery,
  createTeamInviteEmailDelivery,
} from "./email-delivery";
import { ExtensionSignInError, ExtensionSignInService } from "./extension-sign-in";
import {
  COUNT_FEEDBACK,
  DELETE_EARLIER_FEEDBACK_DAYS,
  FEEDBACK_DAILY_LIMIT,
  UNCOUNT_FEEDBACK,
} from "./feedback-daily-counts";
import { feedbackOwner } from "./feedback-owner";
import { GitHubInstallationTokens, GitHubInstallationTokensError } from "./github-installation-tokens";
import { JsonBodyError } from "./json-body";
import { kirimiWebhookSecret } from "./kirimi-delivery";
import { readKirimiForwardUrl } from "./kirimi-forward";
import { type ApnsRelaySender, sharedApnsSender } from "./live-activity-relay";
import { MarketplaceQueryError } from "./marketplace-pagination";
import {
  enforceMarketplaceMutation,
  type MarketplaceMutationKind,
  MarketplaceRateLimitError,
} from "./marketplace-request-policy";
import { type ObjectBucket, StorageNotConfiguredError } from "./object-storage";
import { OrganizationError, Organizations } from "./organizations";
import { readOwnerPolicy } from "./owner-accounts";
import {
  deliverPendingRemoteAuthEvents,
  notifyAccountProfileChanged,
  RemoteControlPlane,
  RemoteControlPlaneError,
  verifyRemoteServiceSignature,
} from "./remote-control-plane";
import { SkillMarketplace, SkillMarketplaceError } from "./skill-marketplace";
import { SlackAppError, SlackAppService } from "./slack-app";
import {
  type OwnerTransferEmailDelivery,
  requireWorkerBindings,
  type TeamInviteEmailDelivery,
  type WorkerBindings,
} from "./types";
import { isUpdateManifest, UPDATE_DOWNLOAD_SECONDS, UPDATE_UPLOAD_SECONDS, updateFileLink } from "./update-feed";

function accountAnalytics(bindings: WorkerBindings): AccountAnalytics {
  return createAccountAnalytics({
    clientId: bindings.OPENPANEL_CLIENT_ID,
    clientSecret: bindings.OPENPANEL_CLIENT_SECRET,
    fetch: (input, init) => fetch(input, init),
    schedule,
  });
}

/** The secret in the path of the Kirimi incoming-message webhook. Null when reverse sign-in is off. */
export function requestKirimiWebhookSecret(): string | null {
  return kirimiWebhookSecret(requireWorkerBindings(env));
}

export function requestKirimiForwardUrl(): string | null {
  return readKirimiForwardUrl(requireWorkerBindings(env));
}

export function requestAuthService(): AuthService {
  const bindings = requireWorkerBindings(env);
  const exposeDevelopmentCode = bindings.AUTH_EXPOSE_DEVELOPMENT_CODE === "true";
  const analytics = accountAnalytics(bindings);
  return new AuthService({
    repository: new D1AuthRepository(bindings.DB),
    delivery: exposeDevelopmentCode ? null : createEmailCodeDelivery(bindings, analytics),
    exposeDevelopmentCode,
    flushSessionRevocations: () => Effect.sync(() => schedule(deliverPendingRemoteAuthEvents(bindings, Date.now()))),
    profileChanged: (userId) => notifyAccountProfileChanged(bindings, userId, schedule),
    analytics,
    attribution: new AccountAttribution({ database: bindings.DB, analytics }),
    ownerPolicy: readOwnerPolicy(bindings.OWNER_WHATSAPP_NUMBERS),
  });
}

export function requestExtensionSignIn(): ExtensionSignInService {
  const bindings = requireWorkerBindings(env);
  return new ExtensionSignInService(bindings, {
    flushSessionRevocations: () => Effect.sync(() => schedule(deliverPendingRemoteAuthEvents(bindings, Date.now()))),
  });
}

export function extensionSignInErrorResponse(error: unknown): Response {
  if (error instanceof ExtensionSignInError) return apiError(error.status, error.code, error.message);
  return remoteControlPlaneErrorResponse(error);
}

export function requestAvatarBucket(): ObjectBucket {
  const bindings = requireWorkerBindings(env);
  return bindings.AVATARS;
}

export function requestSkillMarketplace(): SkillMarketplace {
  const bindings = requireWorkerBindings(env);
  return new SkillMarketplace(bindings);
}

export function requestAgentMarketplace(): AgentMarketplace {
  return new AgentMarketplace(requireWorkerBindings(env));
}

export function requestAgentTemplates(): AgentTemplates {
  return new AgentTemplates(requireWorkerBindings(env));
}

let githubInstallationTokens: { key: string; service: GitHubInstallationTokens } | null = null;

export function requestGitHubInstallationTokens(): GitHubInstallationTokens {
  const bindings = requireWorkerBindings(env);
  const clientId = bindings.GITHUB_APP_CLIENT_ID?.trim();
  const privateKey = bindings.GITHUB_APP_PRIVATE_KEY?.trim();
  if (!clientId || !privateKey) {
    throw new GitHubInstallationTokensError(503, "github_app_unavailable", "The OpenBot GitHub App is not configured.");
  }
  const key = `${clientId}\u0000${privateKey}`;
  if (githubInstallationTokens?.key !== key) {
    githubInstallationTokens = {
      key,
      service: new GitHubInstallationTokens({ clientId, privateKey, fetch: (input, init) => fetch(input, init) }),
    };
  }
  return githubInstallationTokens.service;
}

export const enforceGitHubTokenRateLimit = Effect.fn("GitHub.enforceTokenRateLimit")(function* (sourceIp: string) {
  const result = yield* Effect.tryPromise({
    try: () => requireWorkerBindings(env).GITHUB_TOKEN_RATE_LIMITER.limit({ key: `ip:${sourceIp}` }),
    catch: () =>
      new GitHubInstallationTokensError(503, "github_app_unavailable", "The OpenBot GitHub App is unavailable."),
  });
  if (!result.success) {
    return yield* new GitHubInstallationTokensError(
      429,
      "rate_limited",
      "Too many GitHub token requests. Try again later.",
    );
  }
});

export const enforceFeedbackSearchRateLimit = Effect.fn("GitHub.enforceFeedbackSearchRateLimit")(function* (
  userId: string,
) {
  const limiter = requireWorkerBindings(env).FEEDBACK_RATE_LIMITER;
  const unavailable = () =>
    new GitHubInstallationTokensError(503, "feedback_unavailable", "Feedback is not available.");
  if (!limiter) return yield* unavailable();
  const result = yield* Effect.tryPromise({
    try: () => limiter.limit({ key: `search:${userId}` }),
    catch: unavailable,
  });
  if (!result.success) {
    return yield* new GitHubInstallationTokensError(429, "rate_limited", "Too many searches. Try again later.");
  }
});

export function requestFeedbackOwner(userId: string) {
  const privateKey = requireWorkerBindings(env).GITHUB_APP_PRIVATE_KEY?.trim();
  if (!privateKey)
    return Effect.fail(
      new GitHubInstallationTokensError(503, "github_app_unavailable", "The OpenBot GitHub App is not configured."),
    );
  return feedbackOwner(privateKey, userId);
}

export function requestFeedbackWithdrawnRepository(): string | null {
  const repository = requireWorkerBindings(env).FEEDBACK_WITHDRAWN_REPOSITORY?.trim();
  if (!repository || !/^[\w.-]+\/[\w.-]+$/u.test(repository)) return null;
  const owner = (name: string) => name.split("/")[0]?.toLowerCase();
  return owner(repository) === owner(FEEDBACK_REPOSITORY) ? repository : null;
}

export const enforceFeedbackWithdrawRateLimit = Effect.fn("GitHub.enforceFeedbackWithdrawRateLimit")(function* (
  userId: string,
) {
  const limiter = requireWorkerBindings(env).FEEDBACK_RATE_LIMITER;
  const unavailable = () =>
    new GitHubInstallationTokensError(503, "feedback_unavailable", "Feedback is not available.");
  if (!limiter) return yield* unavailable();
  const result = yield* Effect.tryPromise({
    try: () => limiter.limit({ key: `withdraw:${userId}` }),
    catch: unavailable,
  });
  if (!result.success) {
    return yield* new GitHubInstallationTokensError(429, "rate_limited", "Too many requests. Try again later.");
  }
});

export const enforceFeedbackRateLimit = Effect.fn("GitHub.enforceFeedbackRateLimit")(function* (userId: string) {
  const bindings = requireWorkerBindings(env);
  const limiter = bindings.FEEDBACK_RATE_LIMITER;
  const unavailable = () =>
    new GitHubInstallationTokensError(503, "feedback_unavailable", "Feedback is not available.");
  if (!limiter) return yield* unavailable();
  const result = yield* Effect.tryPromise({ try: () => limiter.limit({ key: `user:${userId}` }), catch: unavailable });
  if (!result.success) {
    return yield* new GitHubInstallationTokensError(429, "rate_limited", "Too much feedback. Try again later.");
  }
  const day = new Date().toISOString().slice(0, 10);
  const [, counted] = yield* Effect.tryPromise({
    try: () =>
      bindings.DB.batch([
        bindings.DB.prepare(DELETE_EARLIER_FEEDBACK_DAYS).bind(userId, day),
        bindings.DB.prepare(COUNT_FEEDBACK).bind(userId, day, FEEDBACK_DAILY_LIMIT),
      ]),
    catch: unavailable,
  });
  if (!counted?.results.length) {
    return yield* new GitHubInstallationTokensError(
      429,
      "feedback_daily_limit",
      "Too much feedback today. Try again tomorrow.",
    );
  }
  return day;
});

export const uncountFeedback = Effect.fn("GitHub.uncountFeedback")(function* (userId: string, day: string) {
  const bindings = requireWorkerBindings(env);
  yield* Effect.tryPromise(() => bindings.DB.prepare(UNCOUNT_FEEDBACK).bind(userId, day).run()).pipe(Effect.ignore);
});

function secondsToNextUtcDay(now = Date.now()): number {
  const day = 86_400_000;
  return Math.ceil((day - (now % day)) / 1000);
}

export function githubInstallationTokensErrorResponse(error: unknown): Response {
  if (error instanceof GitHubInstallationTokensError) {
    const response = apiError(error.status, error.code, error.message);
    if (error.status === 429)
      response.headers.set("Retry-After", String(error.code === "feedback_daily_limit" ? secondsToNextUtcDay() : 60));
    return response;
  }
  return authErrorResponse(error);
}

export function requestApnsRelay(): {
  sender: ApnsRelaySender;
  allow(hostId: string): Effect.Effect<boolean, AuthOperationError>;
  allowNotification(hostId: string): Effect.Effect<boolean, AuthOperationError>;
} | null {
  const bindings = requireWorkerBindings(env);
  const { APNS_PRIVATE_KEY, APNS_KEY_ID, APNS_TEAM_ID, APNS_TOPIC, APNS_ORIGIN, LIVE_ACTIVITY_RATE_LIMITER } = bindings;
  if (!APNS_PRIVATE_KEY || !APNS_KEY_ID || !APNS_TEAM_ID || !APNS_TOPIC || !LIVE_ACTIVITY_RATE_LIMITER) return null;
  const origin = developmentApnsOrigin(APNS_ORIGIN);
  const limit = relayLimit(LIVE_ACTIVITY_RATE_LIMITER);
  return {
    sender: sharedApnsSender({
      privateKey: APNS_PRIVATE_KEY.replaceAll("\\n", "\n"),
      keyId: APNS_KEY_ID,
      teamId: APNS_TEAM_ID,
      topic: APNS_TOPIC,
      ...(origin ? { origin } : {}),
    }),
    allow: (hostId) => limit(`host:${hostId}`),
    allowNotification: (hostId) => limit(`notification:host:${hostId}`),
  };
}

export function requestFcmRelay(): {
  sender: FcmRelaySender;
  allowNotification(hostId: string): Effect.Effect<boolean, AuthOperationError>;
} | null {
  const { FCM_SERVICE_ACCOUNT, LIVE_ACTIVITY_RATE_LIMITER } = requireWorkerBindings(env);
  if (!FCM_SERVICE_ACCOUNT || !LIVE_ACTIVITY_RATE_LIMITER) return null;
  const sender = sharedFcmSender(FCM_SERVICE_ACCOUNT);
  if (!sender) return null;
  const limit = relayLimit(LIVE_ACTIVITY_RATE_LIMITER);
  return { sender, allowNotification: (hostId) => limit(`notification:host:${hostId}`) };
}

function relayLimit(limiter: RateLimit) {
  return (key: string) =>
    Effect.tryPromise({
      try: () => limiter.limit({ key }),
      catch: () => new AuthOperationError({ message: "Account operation failed." }),
    }).pipe(Effect.map((result) => result.success));
}

function developmentApnsOrigin(value: string | undefined): string | undefined {
  return value && /^http:\/\/127\.0\.0\.1:\d+\/__dev\/apns$/u.test(value) ? value : undefined;
}

export function enforceMarketplaceMutationRateLimit(kind: MarketplaceMutationKind, principal: string) {
  return enforceMarketplaceMutation(requireWorkerBindings(env), kind, principal);
}

export function marketplaceErrorResponse(error: unknown): Response {
  if (error instanceof AgentMarketplaceError) return apiError(error.status, error.code, error.message);
  return skillErrorResponse(error);
}

export function requestUser(request: Request) {
  const token = bearerToken(request);
  if (!token) return Effect.succeed(null);
  return requestAuthService().authenticate(token);
}

export function skillErrorResponse(error: unknown): Response {
  if (error instanceof MarketplaceQueryError) return apiError(400, error.code, error.message);
  if (error instanceof MarketplaceRateLimitError) {
    const response = apiError(error.status, error.code, error.message);
    response.headers.set("Retry-After", String(error.retryAfterSeconds));
    return response;
  }
  if (error instanceof SkillMarketplaceError) return apiError(error.status, error.code, error.message);
  return authErrorResponse(error);
}

export const requireSkillsAdmin = Effect.fn("Auth.requireSkillsAdmin")(function* (request: Request) {
  return yield* adminTokenMatches(requireWorkerBindings(env).SKILLS_ADMIN_TOKEN, bearerToken(request));
});

export const requireReleaseUploader = Effect.fn("Auth.requireReleaseUploader")(function* (request: Request) {
  return yield* adminTokenMatches(requireWorkerBindings(env).RELEASE_UPLOAD_TOKEN, bearerToken(request));
});

export function requestUpdateUploadLink(file: string): Promise<string | null> {
  return updateFileLink({
    env: requireWorkerBindings(env),
    method: "PUT",
    file,
    expiresSeconds: UPDATE_UPLOAD_SECONDS,
    now: new Date(),
  });
}

/** Sends the feed file itself and redirects every other release file to the storage. */
export async function requestUpdateFile(file: string, method: "GET" | "HEAD"): Promise<Response> {
  const link = await updateFileLink({
    env: requireWorkerBindings(env),
    method: "GET",
    file,
    expiresSeconds: UPDATE_DOWNLOAD_SECONDS,
    now: new Date(),
  });
  if (!link) return new Response("Not found.", { status: 404 });
  if (!isUpdateManifest(file)) {
    return new Response(null, { status: 302, headers: { Location: link, "Cache-Control": "no-store" } });
  }
  const stored = await fetch(link);
  if (!stored.ok) return new Response("Not found.", { status: 404, headers: { "Cache-Control": "no-store" } });
  return new Response(method === "HEAD" ? null : stored.body, {
    headers: { "Content-Type": "text/yaml; charset=utf-8", "Cache-Control": "no-store" },
  });
}

export function requestContactMessageServices(): ContactMessageServices {
  const bindings = requireWorkerBindings(env);
  return {
    repository: new D1AuthRepository(bindings.DB),
    now: () => Date.now(),
    delivery: () => createContactMessageDelivery(bindings, accountAnalytics(bindings)),
  };
}

export function requestTeamInviteEmailDelivery(): TeamInviteEmailDelivery | null {
  const bindings = requireWorkerBindings(env);
  return createTeamInviteEmailDelivery(bindings, accountAnalytics(bindings));
}

export function requestOwnerTransferEmailDelivery(): OwnerTransferEmailDelivery | null {
  const bindings = requireWorkerBindings(env);
  return createOwnerTransferEmailDelivery(bindings, accountAnalytics(bindings));
}

export function requestRemoteControlPlane(): RemoteControlPlane {
  return new RemoteControlPlane(requireWorkerBindings(env), { schedule });
}

export function verifyRemoteServiceRequest(request: Request, body: string) {
  const secret = requireWorkerBindings(env).REMOTE_AUTH_WEBHOOK_SECRET;
  if (!secret) return Effect.succeed(false);
  return verifyRemoteServiceSignature(
    secret,
    body,
    request.headers.get("OpenBot-Timestamp") ?? "",
    request.headers.get("OpenBot-Signature") ?? "",
  );
}

export function remoteControlPlaneErrorResponse(error: unknown): Response {
  if (error instanceof RemoteControlPlaneError) return apiError(error.status, error.code, error.message);
  return authErrorResponse(error);
}

export function githubRouteErrorResponse(error: unknown): Response {
  if (error instanceof RemoteControlPlaneError) return remoteControlPlaneErrorResponse(error);
  return githubInstallationTokensErrorResponse(error);
}

export function requestSlackApp(): SlackAppService {
  const bindings = requireWorkerBindings(env);
  return new SlackAppService(bindings, {
    flushAuthEvents: () => Effect.sync(() => schedule(deliverPendingRemoteAuthEvents(bindings, Date.now()))),
  });
}

export function slackAppErrorResponse(error: unknown): Response {
  if (error instanceof SlackAppError) return apiError(error.status, error.code, error.message);
  return authErrorResponse(error);
}

export function requestDiscordApp(): DiscordAppService {
  const bindings = requireWorkerBindings(env);
  return new DiscordAppService(bindings, {
    flushAuthEvents: () => Effect.sync(() => schedule(deliverPendingRemoteAuthEvents(bindings, Date.now()))),
  });
}

export function discordAppErrorResponse(error: unknown): Response {
  if (error instanceof DiscordAppError) return apiError(error.status, error.code, error.message);
  return authErrorResponse(error);
}

export function requestAccountVault(): AccountVault {
  return new AccountVault(requireWorkerBindings(env).DB);
}

export function requestAccountVaultBlobs(): AccountVaultBlobs {
  const bindings = requireWorkerBindings(env);
  return new AccountVaultBlobs(bindings.DB, bindings.SKILLS);
}

export function accountVaultErrorResponse(error: unknown): Response {
  if (error instanceof AccountVaultError) {
    return json({ error: { code: error.code, message: error.message, ...error.details } }, error.status);
  }
  return authErrorResponse(error);
}

export function requestOrganizations(): Organizations {
  const bindings = requireWorkerBindings(env);
  return new Organizations({
    database: bindings.DB,
    ownerEmails: readOwnerPolicy(bindings.OWNER_WHATSAPP_NUMBERS).owners,
    vaultKey: bindings.ORG_VAULT_KEY,
    servers: {
      join: (userId, input) => requestRemoteControlPlane().joinOrganizationHost(userId, input),
      revokeAll: (userId, organizationId) =>
        requestRemoteControlPlane().revokeOrganizationHosts(userId, organizationId),
    },
  });
}

export function requestArtifacts(): Artifacts {
  const bindings = requireWorkerBindings(env);
  return new Artifacts({
    database: bindings.DB,
    // Artifacts share the account bucket; their keys start with `artifacts/`.
    bucket: () => bindings.AVATARS,
    ownerEmails: readOwnerPolicy(bindings.OWNER_WHATSAPP_NUMBERS).owners,
  });
}

export function artifactErrorResponse(error: unknown): Response {
  if (error instanceof ArtifactError) return apiError(error.status, error.code, error.message);
  return authErrorResponse(error);
}

/** The account that the web sign-in cookie belongs to. Pages outside the browser API use this. */
export function requestBrowserUser(request: Request) {
  const token = browserSessionToken(request);
  if (!token) return Effect.succeed(null);
  return requestAuthService().authenticate(token);
}

export function organizationErrorResponse(error: unknown): Response {
  if (error instanceof OrganizationError) {
    return json({ error: { code: error.code, message: error.message, ...error.details } }, error.status);
  }
  return authErrorResponse(error);
}

export function bearerToken(request: Request): string | null {
  const authorization = request.headers.get("Authorization");
  if (!authorization?.startsWith("Bearer ")) return null;
  const token = authorization.slice("Bearer ".length);
  return token && token.length <= 512 ? token : null;
}

export function json(value: unknown, status = 200): Response {
  return Response.json(value, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

export function publicMarketplaceJson(value: unknown): Response {
  return Response.json(value, {
    headers: {
      "Cache-Control": "public, max-age=60, stale-while-revalidate=300, stale-if-error=300",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

export function apiError(status: number, code: string, message: string): Response {
  return json({ error: { code, message } }, status);
}

export function authErrorResponse(error: unknown): Response {
  if (error instanceof StorageNotConfiguredError) {
    return apiError(503, "storage_not_configured", "Object storage is not configured.");
  }
  if (error instanceof JsonBodyError) {
    return apiError(error.status, error.code, error.message);
  }
  if (error instanceof AuthServiceError) {
    const response = apiError(error.status, error.code, error.message);
    if (error.retryAfterSeconds !== undefined) {
      response.headers.set("Retry-After", String(error.retryAfterSeconds));
    }
    return response;
  }
  const reference = `auth/${crypto.randomUUID().replaceAll("-", "").slice(0, 16)}`;
  console.error("Account service request failed:", reference, errorType(error));
  return json(
    { error: { code: "internal_error", message: "The account service could not complete the request.", reference } },
    500,
  );
}

function errorType(error: unknown): string {
  if (isDynamicRecord(error) && isString(error._tag)) return error._tag;
  return error instanceof Error ? error.name : typeof error;
}

export function schedule<E>(work: Effect.Effect<void, E>): void {
  waitUntil(runApiEffect(work));
}

export function browserApiErrorResponse(error: unknown): Response {
  return remoteControlPlaneErrorResponse(error);
}
