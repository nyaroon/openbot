import { BOARD_LIMITS } from "@openbot/contracts/input-limits";
import type { BoardActor, BoardCard, BoardColumn } from "@openbot/contracts/ipc";

export interface BoardsMember {
  id: string;
  name: string;
}

export interface BoardsAgent {
  id: string;
  name: string;
}

export interface BoardsThread {
  id: string;
  title: string;
}

export type BoardsLoad = "loading" | "ready" | "failed";

export interface BoardsFilter {
  text: string;
  mine: boolean;
}

export const CARD_POSITION_STEP = 1024;

export function cardOrder(left: BoardCard, right: BoardCard): number {
  return left.position - right.position || left.id.localeCompare(right.id);
}

export function groupCards(columns: readonly BoardColumn[], cards: readonly BoardCard[]): Map<string, BoardCard[]> {
  const groups = new Map<string, BoardCard[]>();
  for (const column of columns) groups.set(column.id, []);
  for (const card of [...cards].sort(cardOrder)) groups.get(card.columnId)?.push(card);
  return groups;
}

export function actorKey(actor: BoardActor | null): string {
  return actor === null ? "none" : `${actor.kind}:${actor.id}`;
}

export function actorOfKey(key: string): BoardActor | null {
  const separator = key.indexOf(":");
  if (separator < 0) return null;
  const kind = key.slice(0, separator);
  const id = key.slice(separator + 1);
  if (id === "") return null;
  if (kind === "member" || kind === "agent") return { kind, id };
  return null;
}

export function cardMatches(
  card: BoardCard,
  filter: BoardsFilter,
  currentMemberId: string | null,
  assigneeName: (actor: BoardActor | null) => string,
): boolean {
  if (filter.mine && !(card.assignee?.kind === "member" && card.assignee.id === currentMemberId)) return false;
  const needle = filter.text.trim().toLocaleLowerCase();
  if (needle === "") return true;
  const haystack = [card.title, card.description, assigneeName(card.assignee), ...card.labels]
    .join("\n")
    .toLocaleLowerCase();
  return haystack.includes(needle);
}

export function filterActive(filter: BoardsFilter): boolean {
  return filter.mine || filter.text.trim() !== "";
}

export function localToday(now = new Date()): string {
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

export function isOverdue(card: BoardCard, today: string, doneColumn: boolean): boolean {
  return card.dueAt !== null && !doneColumn && card.dueAt < today;
}

export function dateValue(date: string): Date {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(year ?? 1970, (month ?? 1) - 1, day ?? 1);
}

export function parseLabels(draft: readonly string[], addition: string): string[] {
  const label = addition.trim().slice(0, BOARD_LIMITS.label);
  if (label === "") return [...draft];
  const known = draft.some((existing) => existing.toLocaleLowerCase() === label.toLocaleLowerCase());
  if (known || draft.length >= BOARD_LIMITS.labels) return [...draft];
  return [...draft, label];
}

export function initialsOf(name: string): string {
  const parts = name.split(/[\s._-]+/u).filter((part) => part !== "");
  const first = parts[0]?.[0] ?? "?";
  const second = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? "") : "";
  return `${first}${second}`.toLocaleUpperCase();
}

/**
 * Where a card lands when it moves into a column: the id of the card it goes
 * before, or null for the end. This is the same shape the host expects.
 */
export interface CardPlacement {
  columnId: string;
  beforeCardId: string | null;
}

export function sameColumnNeighbour(
  columnCards: readonly BoardCard[],
  cardId: string,
  direction: "up" | "down",
): CardPlacement | null {
  const index = columnCards.findIndex((card) => card.id === cardId);
  const column = columnCards[index]?.columnId;
  if (index < 0 || column === undefined) return null;
  if (direction === "up") {
    const before = columnCards[index - 1];
    return before === undefined ? null : { columnId: column, beforeCardId: before.id };
  }
  if (index >= columnCards.length - 1) return null;
  return { columnId: column, beforeCardId: columnCards[index + 2]?.id ?? null };
}

/**
 * Applies a move to a card list without a round trip. The position is a guess
 * between the neighbours; the host answers with the real one.
 */
export function moveCardLocally(cards: readonly BoardCard[], cardId: string, placement: CardPlacement): BoardCard[] {
  const moving = cards.find((card) => card.id === cardId);
  if (moving === undefined) return [...cards];
  const target = cards
    .filter((card) => card.columnId === placement.columnId && card.id !== cardId && card.archivedAt === null)
    .sort(cardOrder);
  const nextIndex =
    placement.beforeCardId === null ? -1 : target.findIndex((card) => card.id === placement.beforeCardId);
  const next = nextIndex < 0 ? undefined : target[nextIndex];
  const previous = nextIndex < 0 ? target[target.length - 1] : target[nextIndex - 1];
  let position: number;
  if (next === undefined) position = (previous?.position ?? 0) + CARD_POSITION_STEP;
  else if (previous === undefined) position = next.position - CARD_POSITION_STEP;
  else position = (previous.position + next.position) / 2;
  return cards.map((card) => (card.id === cardId ? { ...card, columnId: placement.columnId, position } : card));
}

export function placementIndex(columnCards: readonly BoardCard[], cardId: string, beforeCardId: string | null): number {
  const rest = columnCards.filter((card) => card.id !== cardId);
  if (beforeCardId === null) return rest.length;
  const index = rest.findIndex((card) => card.id === beforeCardId);
  return index < 0 ? rest.length : index;
}
