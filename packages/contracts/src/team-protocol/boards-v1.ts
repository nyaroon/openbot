import { BOARD_LIMITS } from "../input-limits";
import { BOARD_COLORS, type BoardsChangeKind } from "../ipc-boards";
import { isDynamicRecord, isString } from "../runtime-values";
import {
  type AdminDecoder,
  adminRoute,
  boolean,
  count,
  fields,
  identifier,
  list,
  nullable,
  type OptionalRouteCodec,
  oneOf,
  string,
} from "./admin-wire";

export const BOARDS_CAPABILITY = "boards-v1";

export const BOARDS_ROUTES = {
  list: "/v1/boards/list",
  get: "/v1/boards/get",
  archivedCards: "/v1/boards/archived-cards",
  boardCreate: "/v1/boards/board-create",
  boardUpdate: "/v1/boards/board-update",
  boardArchive: "/v1/boards/board-archive",
  boardDelete: "/v1/boards/board-delete",
  columnCreate: "/v1/boards/column-create",
  columnUpdate: "/v1/boards/column-update",
  columnMove: "/v1/boards/column-move",
  columnDelete: "/v1/boards/column-delete",
  cardCreate: "/v1/boards/card-create",
  cardUpdate: "/v1/boards/card-update",
  cardArchive: "/v1/boards/card-archive",
  cardDelete: "/v1/boards/card-delete",
  cardMove: "/v1/boards/card-move",
} as const;

export const BOARDS_CHANGE_ROUTES = {
  "board-create": BOARDS_ROUTES.boardCreate,
  "board-update": BOARDS_ROUTES.boardUpdate,
  "board-archive": BOARDS_ROUTES.boardArchive,
  "board-delete": BOARDS_ROUTES.boardDelete,
  "column-create": BOARDS_ROUTES.columnCreate,
  "column-update": BOARDS_ROUTES.columnUpdate,
  "column-move": BOARDS_ROUTES.columnMove,
  "column-delete": BOARDS_ROUTES.columnDelete,
  "card-create": BOARDS_ROUTES.cardCreate,
  "card-update": BOARDS_ROUTES.cardUpdate,
  "card-archive": BOARDS_ROUTES.cardArchive,
  "card-delete": BOARDS_ROUTES.cardDelete,
  "card-move": BOARDS_ROUTES.cardMove,
} as const satisfies Record<BoardsChangeKind, string>;

export type BoardsEvent = { type: "boards-changed"; boardId: string };

export function boardsEvent(value: unknown): BoardsEvent | null {
  if (!isDynamicRecord(value) || value.type !== "boards-changed" || !isString(value.boardId)) return null;
  if (value.boardId.length === 0 || value.boardId.length > 128) return null;
  return { type: "boards-changed", boardId: value.boardId };
}

const timestamp = string(64);
const date: AdminDecoder = (value) => {
  if (!isString(value) || !/^\d{4}-\d{2}-\d{2}$/u.test(value)) throw new Error("Invalid board date.");
  return value;
};
const ordinal: AdminDecoder = (value) => {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 1) throw new Error("Invalid board number.");
  return value;
};
const position: AdminDecoder = (value) => {
  if (typeof value !== "number" || !Number.isSafeInteger(value)) throw new Error("Invalid board position.");
  return value;
};
const index: AdminDecoder = (value) => {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0 || value >= BOARD_LIMITS.columns)
    throw new Error("Invalid board column index.");
  return value;
};
const color = nullable(oneOf(...BOARD_COLORS));
const boardName = string(BOARD_LIMITS.boardName);
const columnName = string(BOARD_LIMITS.columnName);
const actor = fields({ kind: oneOf("member", "agent"), id: identifier });
const threadLink = fields({ agentId: identifier, threadId: identifier });
const cardTitle = string(BOARD_LIMITS.cardTitle);
const cardOptional: Record<string, AdminDecoder> = {
  description: string(BOARD_LIMITS.cardDescription),
  assignee: nullable(actor),
  thread: nullable(threadLink),
  dueAt: nullable(date),
  labels: list(string(BOARD_LIMITS.label), BOARD_LIMITS.labels),
};
const cardFields: Record<string, AdminDecoder> = { title: cardTitle, ...cardOptional };

const column = fields({ id: identifier, name: columnName, position: count, done: boolean, cardCount: count });
const boardSummary = fields({
  id: identifier,
  name: boardName,
  description: string(BOARD_LIMITS.boardDescription),
  color,
  position,
  archivedAt: nullable(timestamp),
  createdBy: identifier,
  createdAt: timestamp,
  updatedAt: timestamp,
  updatedBy: actor,
  revision: ordinal,
  columns: list(column, BOARD_LIMITS.columns),
});
const card = fields({
  id: identifier,
  boardId: identifier,
  columnId: identifier,
  position,
  title: string(BOARD_LIMITS.cardTitle),
  description: string(BOARD_LIMITS.cardDescription),
  assignee: nullable(actor),
  thread: nullable(threadLink),
  dueAt: nullable(date),
  labels: list(string(BOARD_LIMITS.label), BOARD_LIMITS.labels),
  createdBy: actor,
  updatedBy: actor,
  createdAt: timestamp,
  updatedAt: timestamp,
  archivedAt: nullable(timestamp),
});
const boardId = fields({ boardId: identifier });
const mutation = fields({
  boardId: identifier,
  revision: count,
  board: nullable(boardSummary),
  card: nullable(card),
  deleted: boolean,
});

const boardEdit = { description: string(BOARD_LIMITS.boardDescription), color };

export const BOARDS_CODECS: ReadonlyMap<string, OptionalRouteCodec> = new Map([
  [BOARDS_ROUTES.list, adminRoute(fields({}), fields({ boards: list(boardSummary, BOARD_LIMITS.boards) }))],
  [
    BOARDS_ROUTES.get,
    adminRoute(boardId, fields({ board: boardSummary, cards: list(card, BOARD_LIMITS.activeCards) })),
  ],
  [BOARDS_ROUTES.archivedCards, adminRoute(boardId, fields({ cards: list(card, BOARD_LIMITS.archivedCards) }))],
  [
    BOARDS_ROUTES.boardCreate,
    adminRoute(
      fields(
        {
          kind: oneOf("board-create"),
          name: boardName,
          columnNames: list(columnName, BOARD_LIMITS.columns),
        },
        boardEdit,
      ),
      mutation,
    ),
  ],
  [
    BOARDS_ROUTES.boardUpdate,
    adminRoute(
      fields({ kind: oneOf("board-update"), boardId: identifier }, { name: boardName, ...boardEdit }),
      mutation,
    ),
  ],
  [
    BOARDS_ROUTES.boardArchive,
    adminRoute(fields({ kind: oneOf("board-archive"), boardId: identifier, archived: boolean }), mutation),
  ],
  [BOARDS_ROUTES.boardDelete, adminRoute(fields({ kind: oneOf("board-delete"), boardId: identifier }), mutation)],
  [
    BOARDS_ROUTES.columnCreate,
    adminRoute(
      fields({ kind: oneOf("column-create"), boardId: identifier, name: columnName }, { done: boolean }),
      mutation,
    ),
  ],
  [
    BOARDS_ROUTES.columnUpdate,
    adminRoute(
      fields({ kind: oneOf("column-update"), columnId: identifier }, { name: columnName, done: boolean }),
      mutation,
    ),
  ],
  [BOARDS_ROUTES.columnMove, adminRoute(fields({ kind: oneOf("column-move"), columnId: identifier, index }), mutation)],
  [
    BOARDS_ROUTES.columnDelete,
    adminRoute(fields({ kind: oneOf("column-delete"), columnId: identifier }, { moveCardsTo: identifier }), mutation),
  ],
  [
    BOARDS_ROUTES.cardCreate,
    adminRoute(
      fields({ kind: oneOf("card-create"), boardId: identifier, columnId: identifier, title: cardTitle }, cardOptional),
      mutation,
    ),
  ],
  [
    BOARDS_ROUTES.cardUpdate,
    adminRoute(fields({ kind: oneOf("card-update"), cardId: identifier, patch: fields({}, cardFields) }), mutation),
  ],
  [
    BOARDS_ROUTES.cardArchive,
    adminRoute(fields({ kind: oneOf("card-archive"), cardId: identifier, archived: boolean }), mutation),
  ],
  [BOARDS_ROUTES.cardDelete, adminRoute(fields({ kind: oneOf("card-delete"), cardId: identifier }), mutation)],
  [
    BOARDS_ROUTES.cardMove,
    adminRoute(
      fields({
        kind: oneOf("card-move"),
        cardId: identifier,
        columnId: identifier,
        beforeCardId: nullable(identifier),
      }),
      mutation,
    ),
  ],
]);
