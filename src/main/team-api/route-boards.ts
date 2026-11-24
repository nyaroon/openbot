import type { BoardActor, BoardsChange } from "@openbot/contracts/ipc";
import { isBoardIdInput, isBoardsChange } from "@openbot/contracts/ipc";
import { BOARDS_CAPABILITY, BOARDS_CHANGE_ROUTES, BOARDS_ROUTES } from "@openbot/contracts/team-protocol/boards-v1";
import { sourceText } from "@openbot/i18n/source";
import { Effect } from "effect";
import { BoardsError } from "../../backend/boards/boards-handle";
import type { TeamApiBoards } from "./dependencies";
import { HttpError } from "./http-error";
import type { RouteOutcome, TeamApiRequestContext } from "./request-context";
import { readJson, requireAdmin, WEBRTC_FRAME_BODY_BUDGET } from "./request-helpers";

const BOARDS_PATHS: ReadonlySet<string> = new Set(Object.values(BOARDS_ROUTES));

function invalid(): HttpError {
  return new HttpError(400, sourceText("error.boards.invalidChange"));
}

async function run<A>(operation: Effect.Effect<A, BoardsError>): Promise<A> {
  try {
    return await Effect.runPromise(operation);
  } catch (error) {
    if (error instanceof BoardsError) throw new HttpError(error.code === "missing" ? 404 : 400, error.message);
    throw error;
  }
}

function fitted<A>(value: A): A {
  if (Buffer.byteLength(JSON.stringify(value)) > WEBRTC_FRAME_BODY_BUDGET)
    throw new HttpError(413, sourceText("error.boards.tooLargeToSend"));
  return value;
}

function changeFor(path: string, body: unknown): BoardsChange {
  if (!isBoardsChange(body) || BOARDS_CHANGE_ROUTES[body.kind] !== path) throw invalid();
  return body;
}

export async function routeBoards(
  context: TeamApiRequestContext,
  boards: TeamApiBoards | undefined,
): Promise<RouteOutcome> {
  const { method, url, capabilities, member, request, json } = context;
  const path = url.pathname;
  if (method !== "POST" || !BOARDS_PATHS.has(path)) return "unmatched";
  if (!boards || !capabilities.has(BOARDS_CAPABILITY))
    throw new HttpError(400, sourceText("error.boards.serverTooOld"));
  const body = await readJson(request);
  const actor: BoardActor = { kind: "member", id: member.id };
  if (path === BOARDS_ROUTES.list) return json(200, fitted(await run(boards.list())));
  if (path === BOARDS_ROUTES.get || path === BOARDS_ROUTES.archivedCards) {
    if (!isBoardIdInput(body)) throw invalid();
    return json(200, fitted(await run(path === BOARDS_ROUTES.get ? boards.get(body) : boards.archivedCards(body))));
  }
  const change = changeFor(path, body);
  if (change.kind === "board-delete") requireAdmin(member);
  return json(200, fitted(await run(boards.apply(change, actor))));
}
