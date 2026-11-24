import { BOARD_LIMITS } from "./input-limits";
import { integerInRange, isBoundedString, isIdentifier } from "./ipc-bounded-values";
import { type DynamicRecord, isBoolean, isDynamicRecord, isOneOf, isString } from "./runtime-values";

export const BOARD_COLORS = ["slate", "blue", "green", "amber", "red", "violet"] as const;
export type BoardColor = (typeof BOARD_COLORS)[number];

export const BOARD_ACTOR_KINDS = ["member", "agent"] as const;
export type BoardActorKind = (typeof BOARD_ACTOR_KINDS)[number];

export interface BoardActor {
  kind: BoardActorKind;
  id: string;
}

export interface BoardThreadLink {
  agentId: string;
  threadId: string;
}

export interface BoardColumn {
  id: string;
  name: string;
  position: number;
  done: boolean;
  cardCount: number;
}

export interface BoardSummary {
  id: string;
  name: string;
  description: string;
  color: BoardColor | null;
  position: number;
  archivedAt: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  updatedBy: BoardActor;
  revision: number;
  columns: BoardColumn[];
}

export interface BoardCard {
  id: string;
  boardId: string;
  columnId: string;
  position: number;
  title: string;
  description: string;
  assignee: BoardActor | null;
  thread: BoardThreadLink | null;
  dueAt: string | null;
  labels: string[];
  createdBy: BoardActor;
  updatedBy: BoardActor;
  createdAt: string;
  updatedAt: string;
  archivedAt: string | null;
}

export interface BoardList {
  boards: BoardSummary[];
}

export interface BoardDetail {
  board: BoardSummary;
  cards: BoardCard[];
}

export interface BoardArchivedCards {
  cards: BoardCard[];
}

export interface BoardIdInput {
  boardId: string;
}

export interface BoardMutation {
  boardId: string;
  revision: number;
  board: BoardSummary | null;
  card: BoardCard | null;
  deleted: boolean;
}

export interface BoardCardFields {
  title: string;
  description: string;
  assignee: BoardActor | null;
  thread: BoardThreadLink | null;
  dueAt: string | null;
  labels: string[];
}

export type BoardCardInput = Partial<BoardCardFields> & { title: string };
export type BoardCardPatch = Partial<BoardCardFields>;

export type BoardsChange =
  | { kind: "board-create"; name: string; description?: string; color?: BoardColor | null; columnNames: string[] }
  | { kind: "board-update"; boardId: string; name?: string; description?: string; color?: BoardColor | null }
  | { kind: "board-archive"; boardId: string; archived: boolean }
  | { kind: "board-delete"; boardId: string }
  | { kind: "column-create"; boardId: string; name: string; done?: boolean }
  | { kind: "column-update"; columnId: string; name?: string; done?: boolean }
  | { kind: "column-move"; columnId: string; index: number }
  | { kind: "column-delete"; columnId: string; moveCardsTo?: string }
  | ({ kind: "card-create"; boardId: string; columnId: string } & BoardCardInput)
  | { kind: "card-update"; cardId: string; patch: BoardCardPatch }
  | { kind: "card-archive"; cardId: string; archived: boolean }
  | { kind: "card-delete"; cardId: string }
  | { kind: "card-move"; cardId: string; columnId: string; beforeCardId: string | null };

export type BoardsChangeKind = BoardsChange["kind"];

export const BOARDS_CHANGE_KINDS = [
  "board-create",
  "board-update",
  "board-archive",
  "board-delete",
  "column-create",
  "column-update",
  "column-move",
  "column-delete",
  "card-create",
  "card-update",
  "card-archive",
  "card-delete",
  "card-move",
] as const satisfies readonly BoardsChangeKind[];

const CARD_FIELD_KEYS = ["title", "description", "assignee", "thread", "dueAt", "labels"] as const;

function isTimestamp(value: unknown): value is string {
  return isBoundedString(value, 64) && value.length > 0;
}

export function isBoardDate(value: unknown): value is string {
  if (!isString(value) || !/^\d{4}-\d{2}-\d{2}$/u.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value);
}

function isNullable<T>(value: unknown, guard: (value: unknown) => value is T): value is T | null {
  return value === null || guard(value);
}

function hasOnly(value: DynamicRecord, keys: readonly string[]): boolean {
  return Object.keys(value).every((key) => keys.includes(key));
}

function isName(value: unknown, maximum: number): value is string {
  return isBoundedString(value, maximum) && value.trim().length > 0 && value.trim() === value;
}

function isColor(value: unknown): value is BoardColor {
  return isOneOf(BOARD_COLORS, value);
}

function isLabelList(value: unknown): value is string[] {
  return (
    Array.isArray(value) &&
    value.length <= BOARD_LIMITS.labels &&
    value.every((label) => isName(label, BOARD_LIMITS.label)) &&
    new Set(value.map((label) => String(label).toLowerCase())).size === value.length
  );
}

export function isBoardActor(value: unknown): value is BoardActor {
  return (
    isDynamicRecord(value) &&
    hasOnly(value, ["kind", "id"]) &&
    isOneOf(BOARD_ACTOR_KINDS, value.kind) &&
    isIdentifier(value.id)
  );
}

export function isBoardThreadLink(value: unknown): value is BoardThreadLink {
  return (
    isDynamicRecord(value) &&
    hasOnly(value, ["agentId", "threadId"]) &&
    isIdentifier(value.agentId) &&
    isIdentifier(value.threadId)
  );
}

function isBoardColumn(value: unknown): value is BoardColumn {
  return (
    isDynamicRecord(value) &&
    isIdentifier(value.id) &&
    isName(value.name, BOARD_LIMITS.columnName) &&
    integerInRange(value.position, 0, Number.MAX_SAFE_INTEGER) &&
    isBoolean(value.done) &&
    integerInRange(value.cardCount, 0, Number.MAX_SAFE_INTEGER)
  );
}

export function isBoardSummary(value: unknown): value is BoardSummary {
  return (
    isDynamicRecord(value) &&
    isIdentifier(value.id) &&
    isName(value.name, BOARD_LIMITS.boardName) &&
    isBoundedString(value.description, BOARD_LIMITS.boardDescription) &&
    isNullable(value.color, isColor) &&
    integerInRange(value.position, -Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER) &&
    isNullable(value.archivedAt, isTimestamp) &&
    isIdentifier(value.createdBy) &&
    isTimestamp(value.createdAt) &&
    isTimestamp(value.updatedAt) &&
    isBoardActor(value.updatedBy) &&
    integerInRange(value.revision, 1, Number.MAX_SAFE_INTEGER) &&
    Array.isArray(value.columns) &&
    value.columns.length <= BOARD_LIMITS.columns &&
    value.columns.every(isBoardColumn)
  );
}

export function isBoardCard(value: unknown): value is BoardCard {
  return (
    isDynamicRecord(value) &&
    isIdentifier(value.id) &&
    isIdentifier(value.boardId) &&
    isIdentifier(value.columnId) &&
    integerInRange(value.position, -Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER) &&
    isName(value.title, BOARD_LIMITS.cardTitle) &&
    isBoundedString(value.description, BOARD_LIMITS.cardDescription) &&
    isNullable(value.assignee, isBoardActor) &&
    isNullable(value.thread, isBoardThreadLink) &&
    isNullable(value.dueAt, isBoardDate) &&
    isLabelList(value.labels) &&
    isBoardActor(value.createdBy) &&
    isBoardActor(value.updatedBy) &&
    isTimestamp(value.createdAt) &&
    isTimestamp(value.updatedAt) &&
    isNullable(value.archivedAt, isTimestamp)
  );
}

export function isBoardList(value: unknown): value is BoardList {
  return (
    isDynamicRecord(value) &&
    Array.isArray(value.boards) &&
    value.boards.length <= BOARD_LIMITS.boards &&
    value.boards.every(isBoardSummary)
  );
}

export function isBoardDetail(value: unknown): value is BoardDetail {
  return (
    isDynamicRecord(value) &&
    isBoardSummary(value.board) &&
    Array.isArray(value.cards) &&
    value.cards.length <= BOARD_LIMITS.activeCards &&
    value.cards.every(isBoardCard)
  );
}

export function isBoardArchivedCards(value: unknown): value is BoardArchivedCards {
  return (
    isDynamicRecord(value) &&
    Array.isArray(value.cards) &&
    value.cards.length <= BOARD_LIMITS.archivedCards &&
    value.cards.every(isBoardCard)
  );
}

export function isBoardIdInput(value: unknown): value is BoardIdInput {
  return isDynamicRecord(value) && hasOnly(value, ["boardId"]) && isIdentifier(value.boardId);
}

export function isBoardMutation(value: unknown): value is BoardMutation {
  return (
    isDynamicRecord(value) &&
    isIdentifier(value.boardId) &&
    integerInRange(value.revision, 0, Number.MAX_SAFE_INTEGER) &&
    isNullable(value.board, isBoardSummary) &&
    isNullable(value.card, isBoardCard) &&
    isBoolean(value.deleted)
  );
}

function isCardFieldValue(key: (typeof CARD_FIELD_KEYS)[number], value: unknown): boolean {
  switch (key) {
    case "title":
      return isName(value, BOARD_LIMITS.cardTitle);
    case "description":
      return isBoundedString(value, BOARD_LIMITS.cardDescription);
    case "assignee":
      return isNullable(value, isBoardActor);
    case "thread":
      return isNullable(value, isBoardThreadLink);
    case "dueAt":
      return isNullable(value, isBoardDate);
    case "labels":
      return isLabelList(value);
  }
}

function areCardFields(value: DynamicRecord): boolean {
  return CARD_FIELD_KEYS.every((key) => value[key] === undefined || isCardFieldValue(key, value[key]));
}

function isCardPatch(value: unknown): value is BoardCardPatch {
  return (
    isDynamicRecord(value) && Object.keys(value).length > 0 && hasOnly(value, CARD_FIELD_KEYS) && areCardFields(value)
  );
}

function isOptionalName(value: DynamicRecord, key: string, maximum: number): boolean {
  return value[key] === undefined || isName(value[key], maximum);
}

function isBoardEdit(value: DynamicRecord): boolean {
  return (
    isOptionalName(value, "name", BOARD_LIMITS.boardName) &&
    (value.description === undefined || isBoundedString(value.description, BOARD_LIMITS.boardDescription)) &&
    (value.color === undefined || isNullable(value.color, isColor))
  );
}

export function isBoardsChange(value: unknown): value is BoardsChange {
  if (!isDynamicRecord(value) || !isOneOf(BOARDS_CHANGE_KINDS, value.kind)) return false;
  switch (value.kind) {
    case "board-create":
      return (
        hasOnly(value, ["kind", "name", "description", "color", "columnNames"]) &&
        isName(value.name, BOARD_LIMITS.boardName) &&
        isBoardEdit(value) &&
        Array.isArray(value.columnNames) &&
        value.columnNames.length >= 1 &&
        value.columnNames.length <= BOARD_LIMITS.columns &&
        value.columnNames.every((name) => isName(name, BOARD_LIMITS.columnName))
      );
    case "board-update":
      return (
        hasOnly(value, ["kind", "boardId", "name", "description", "color"]) &&
        isIdentifier(value.boardId) &&
        isBoardEdit(value)
      );
    case "board-archive":
      return (
        hasOnly(value, ["kind", "boardId", "archived"]) && isIdentifier(value.boardId) && isBoolean(value.archived)
      );
    case "board-delete":
      return hasOnly(value, ["kind", "boardId"]) && isIdentifier(value.boardId);
    case "column-create":
      return (
        hasOnly(value, ["kind", "boardId", "name", "done"]) &&
        isIdentifier(value.boardId) &&
        isName(value.name, BOARD_LIMITS.columnName) &&
        (value.done === undefined || isBoolean(value.done))
      );
    case "column-update":
      return (
        hasOnly(value, ["kind", "columnId", "name", "done"]) &&
        isIdentifier(value.columnId) &&
        isOptionalName(value, "name", BOARD_LIMITS.columnName) &&
        (value.done === undefined || isBoolean(value.done)) &&
        (value.name !== undefined || value.done !== undefined)
      );
    case "column-move":
      return (
        hasOnly(value, ["kind", "columnId", "index"]) &&
        isIdentifier(value.columnId) &&
        integerInRange(value.index, 0, BOARD_LIMITS.columns - 1)
      );
    case "column-delete":
      return (
        hasOnly(value, ["kind", "columnId", "moveCardsTo"]) &&
        isIdentifier(value.columnId) &&
        (value.moveCardsTo === undefined || isIdentifier(value.moveCardsTo))
      );
    case "card-create":
      return (
        hasOnly(value, ["kind", "boardId", "columnId", ...CARD_FIELD_KEYS]) &&
        isIdentifier(value.boardId) &&
        isIdentifier(value.columnId) &&
        isName(value.title, BOARD_LIMITS.cardTitle) &&
        areCardFields(value)
      );
    case "card-update":
      return hasOnly(value, ["kind", "cardId", "patch"]) && isIdentifier(value.cardId) && isCardPatch(value.patch);
    case "card-archive":
      return hasOnly(value, ["kind", "cardId", "archived"]) && isIdentifier(value.cardId) && isBoolean(value.archived);
    case "card-delete":
      return hasOnly(value, ["kind", "cardId"]) && isIdentifier(value.cardId);
    case "card-move":
      return (
        hasOnly(value, ["kind", "cardId", "columnId", "beforeCardId"]) &&
        isIdentifier(value.cardId) &&
        isIdentifier(value.columnId) &&
        isNullable(value.beforeCardId, isIdentifier)
      );
  }
}
