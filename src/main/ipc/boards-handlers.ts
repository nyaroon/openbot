import type { BoardActor } from "@openbot/contracts/ipc";
import { BOARDS_CAPABILITY, BOARDS_CHANGE_ROUTES, BOARDS_ROUTES } from "@openbot/contracts/team-protocol/boards-v1";
import { sourceText } from "@openbot/i18n/source";
import {
  decodeRemoteBoardArchivedCards,
  decodeRemoteBoardDetail,
  decodeRemoteBoardList,
  decodeRemoteBoardMutation,
} from "@openbot/team-client/boards-decoding";
import { Effect } from "effect";
import type { BoardsOperations } from "../../backend/boards/boards-handle";
import { runCauseEffect } from "../../backend/effect-boundary";
import type { ResponseDecoder } from "../remote-host-decoding";
import type { RemoteRequestInit } from "../remote-server-client";
import type { RemoteWorkflowError } from "../remote-service-effects";
import { parseBoardIdInput, parseBoardsChange } from "./boards-inputs";
import type { IpcGroupHandlers } from "./define-ipc-group";
import { scopedHandler, scopedQueryHandler } from "./scoped-handler";

interface BoardsRemoteServers {
  supportsCapability(serverId: string, capability: typeof BOARDS_CAPABILITY): boolean;
  request<T>(
    serverId: string,
    path: string,
    decoder: ResponseDecoder<T>,
    init?: RemoteRequestInit,
  ): Effect.Effect<T, RemoteWorkflowError>;
}

interface BoardsIpcDependencies {
  boards: BoardsOperations;
  localMemberId: () => string;
  remoteServers: BoardsRemoteServers;
}

export function boardsIpcHandlers({
  boards,
  localMemberId,
  remoteServers,
}: BoardsIpcDependencies): Pick<IpcGroupHandlers, "boards"> {
  function remote<T>(serverId: string, path: string, decoder: ResponseDecoder<T>, body: unknown): Promise<T> {
    if (!remoteServers.supportsCapability(serverId, BOARDS_CAPABILITY))
      throw new Error(sourceText("error.boards.serverTooOld"));
    return runCauseEffect(remoteServers.request(serverId, path, decoder, { method: "POST", body }));
  }
  const localActor = (): BoardActor => ({ kind: "member", id: localMemberId() });
  return {
    boards: {
      list: scopedQueryHandler({
        local: () => Effect.runPromise(boards.list()),
        remote: (serverId) => remote(serverId, BOARDS_ROUTES.list, decodeRemoteBoardList, {}),
      }),
      get: scopedHandler(parseBoardIdInput, {
        local: (input) => Effect.runPromise(boards.get(input)),
        remote: (input, serverId) => remote(serverId, BOARDS_ROUTES.get, decodeRemoteBoardDetail, input),
      }),
      archivedCards: scopedHandler(parseBoardIdInput, {
        local: (input) => Effect.runPromise(boards.archivedCards(input)),
        remote: (input, serverId) =>
          remote(serverId, BOARDS_ROUTES.archivedCards, decodeRemoteBoardArchivedCards, input),
      }),
      apply: scopedHandler(parseBoardsChange, {
        local: (change) => Effect.runPromise(boards.apply(change, localActor())),
        remote: (change, serverId) =>
          remote(serverId, BOARDS_CHANGE_ROUTES[change.kind], decodeRemoteBoardMutation, change),
      }),
    },
  };
}
