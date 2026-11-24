import type { AgentEvent, TeamRealtimeEvent } from "@openbot/contracts/ipc";
import { BOARDS_CHANGE_ROUTES, BOARDS_ROUTES, boardsEvent } from "@openbot/contracts/team-protocol/boards-v1";
import { decodeTeamProtocolV2Json } from "@openbot/contracts/team-protocol/v2";
import {
  decodeRemoteBoardArchivedCards,
  decodeRemoteBoardDetail,
  decodeRemoteBoardList,
  decodeRemoteBoardMutation,
} from "@openbot/team-client/boards-decoding";
import type { TeamApiRequest } from "@openbot/team-client/team-api-requests";
import type { BoardsThread } from "@openbot/ui/features/boards/boards-model";
import type { BoardsHost } from "../boards/boards-port";

export interface WebBoardsHostOptions {
  request: () => TeamApiRequest;
  onHostEvent: (listener: (event: AgentEvent | TeamRealtimeEvent) => void) => () => void;
  threads: (agentId: string) => Promise<BoardsThread[]>;
}

export function webBoardsHost(options: WebBoardsHostOptions): BoardsHost {
  const post = <T>(path: string, decode: (value: unknown) => T, body: unknown): Promise<T> =>
    options.request()("POST", path, decode, decodeTeamProtocolV2Json(body));
  return {
    list: () => post(BOARDS_ROUTES.list, decodeRemoteBoardList, {}),
    get: (boardId) => post(BOARDS_ROUTES.get, decodeRemoteBoardDetail, { boardId }),
    archivedCards: (boardId) => post(BOARDS_ROUTES.archivedCards, decodeRemoteBoardArchivedCards, { boardId }),
    apply: (change) => post(BOARDS_CHANGE_ROUTES[change.kind], decodeRemoteBoardMutation, change),
    threads: options.threads,
    onChanged: (listener) =>
      options.onHostEvent((event) => {
        if (event.type === "runtime-snapshot") listener(null);
        else {
          const changed = boardsEvent(event);
          if (changed) listener(changed.boardId);
        }
      }),
  };
}
