import { randomBytes } from "node:crypto";
import type { DatabaseSync, SQLInputValue } from "node:sqlite";
import { BOARD_LIMITS } from "@openbot/contracts/input-limits";
import {
  BOARD_ACTOR_KINDS,
  BOARD_COLORS,
  type BoardActor,
  type BoardArchivedCards,
  type BoardCard,
  type BoardCardPatch,
  type BoardColumn,
  type BoardDetail,
  type BoardList,
  type BoardMutation,
  type BoardSummary,
  type BoardsChange,
  isBoardsChange,
} from "@openbot/contracts/ipc";
import { type DynamicRecord, isOneOf, isString } from "@openbot/contracts/runtime-values";
import { type SourceMessages, sourceText } from "@openbot/i18n/source";
import {
  checkedColumn,
  databaseRow,
  databaseRows,
  optionalStringColumn,
  requiredNumberColumn,
  requiredStringColumn,
} from "../database/database-rows";
import { withTransaction } from "../database/sqlite-transaction";
import { BoardsError } from "./boards-handle";

type BoardsErrorKey = Extract<keyof SourceMessages, `error.boards.${string}`>;

export const BOARD_POSITION_STEP = 1024;

function missing(key: BoardsErrorKey): BoardsError {
  return new BoardsError({ code: "missing", message: sourceText(key) });
}

function refused(key: BoardsErrorKey): BoardsError {
  return new BoardsError({ code: "refused", message: sourceText(key) });
}

export function newBoardId(): string {
  return randomBytes(16).toString("hex");
}

export function positionBetween(before: number | undefined, after: number | undefined): number | null {
  if (before === undefined && after === undefined) return 0;
  if (before === undefined) return (after ?? 0) - BOARD_POSITION_STEP;
  if (after === undefined) return before + BOARD_POSITION_STEP;
  return after - before >= 2 ? before + Math.floor((after - before) / 2) : null;
}

function actorOf(row: DynamicRecord, kindKey: string, idKey: string): BoardActor {
  return { kind: checkedColumn(row, kindKey, BOARD_ACTOR_KINDS), id: requiredStringColumn(row, idKey) };
}

function parseLabels(value: string): string[] {
  const parsed = JSON.parse(value);
  if (!Array.isArray(parsed)) throw new Error("Invalid board labels.");
  return parsed.map((label) => {
    if (!isString(label)) throw new Error("Invalid board label.");
    return label;
  });
}

function decodeCard(row: DynamicRecord): BoardCard {
  const assigneeKind = optionalStringColumn(row, "assignee_kind");
  const assigneeId = optionalStringColumn(row, "assignee_id");
  const agentId = optionalStringColumn(row, "agent_id");
  const threadId = optionalStringColumn(row, "thread_id");
  return {
    id: requiredStringColumn(row, "id"),
    boardId: requiredStringColumn(row, "board_id"),
    columnId: requiredStringColumn(row, "column_id"),
    position: requiredNumberColumn(row, "position"),
    title: requiredStringColumn(row, "title"),
    description: requiredStringColumn(row, "description"),
    assignee:
      assigneeKind !== null && assigneeId !== null && isOneOf(BOARD_ACTOR_KINDS, assigneeKind)
        ? { kind: assigneeKind, id: assigneeId }
        : null,
    thread: agentId !== null && threadId !== null ? { agentId, threadId } : null,
    dueAt: optionalStringColumn(row, "due_at"),
    labels: parseLabels(requiredStringColumn(row, "labels_json")),
    createdBy: actorOf(row, "created_by_kind", "created_by"),
    updatedBy: actorOf(row, "updated_by_kind", "updated_by"),
    createdAt: requiredStringColumn(row, "created_at"),
    updatedAt: requiredStringColumn(row, "updated_at"),
    archivedAt: optionalStringColumn(row, "archived_at"),
  };
}

interface ColumnRow {
  id: string;
  boardId: string;
  name: string;
  position: number;
  done: boolean;
}

function decodeColumn(row: DynamicRecord): ColumnRow {
  return {
    id: requiredStringColumn(row, "id"),
    boardId: requiredStringColumn(row, "board_id"),
    name: requiredStringColumn(row, "name"),
    position: requiredNumberColumn(row, "position"),
    done: requiredNumberColumn(row, "done") === 1,
  };
}

interface Placed {
  id: string;
  position: number;
}

function placed(row: DynamicRecord): Placed {
  return { id: requiredStringColumn(row, "id"), position: requiredNumberColumn(row, "position") };
}

export class BoardsStore {
  readonly #db: DatabaseSync;
  readonly #now: () => Date;
  renumbers = 0;

  constructor(db: DatabaseSync, now: () => Date = () => new Date()) {
    this.#db = db;
    this.#now = now;
  }

  list(): BoardList {
    const boards = databaseRows(this.#db.prepare("SELECT * FROM boards ORDER BY position, created_at, id").all());
    const columns = databaseRows(
      this.#db.prepare("SELECT * FROM board_columns ORDER BY board_id, position, id").all(),
    ).map(decodeColumn);
    const counts = this.#cardCounts();
    return {
      boards: boards.map((row) => {
        const id = requiredStringColumn(row, "id");
        return this.#summaryFrom(
          row,
          columns.filter((column) => column.boardId === id),
          counts,
        );
      }),
    };
  }

  get(boardId: string): BoardDetail {
    const cards = databaseRows(
      this.#db
        .prepare("SELECT * FROM board_cards WHERE board_id = ? AND archived_at IS NULL ORDER BY position, id")
        .all(boardId),
    ).map(decodeCard);
    return { board: this.#summary(boardId), cards };
  }

  archivedCards(boardId: string): BoardArchivedCards {
    this.#boardRow(boardId);
    const cards = databaseRows(
      this.#db
        .prepare(
          "SELECT * FROM board_cards WHERE board_id = ? AND archived_at IS NOT NULL ORDER BY archived_at DESC, id LIMIT ?",
        )
        .all(boardId, BOARD_LIMITS.archivedCards),
    ).map(decodeCard);
    return { cards };
  }

  apply(change: BoardsChange, actor: BoardActor): BoardMutation {
    if (!isBoardsChange(change)) throw refused("error.boards.invalidChange");
    return withTransaction(this.#db, () => this.#apply(change, actor));
  }

  #apply(change: BoardsChange, actor: BoardActor): BoardMutation {
    switch (change.kind) {
      case "board-create":
        return this.#boardCreate(change, actor);
      case "board-update":
        return this.#boardUpdate(change, actor);
      case "board-archive": {
        const archivedAt = change.archived ? this.#stamp() : null;
        this.#boardRow(change.boardId);
        this.#db.prepare("UPDATE boards SET archived_at = ? WHERE id = ?").run(archivedAt, change.boardId);
        return this.#boardResult(change.boardId, actor);
      }
      case "board-delete":
        return this.#boardDelete(change.boardId);
      case "column-create":
        return this.#columnCreate(change, actor);
      case "column-update":
        return this.#columnUpdate(change, actor);
      case "column-move":
        return this.#columnMove(change.columnId, change.index, actor);
      case "column-delete":
        return this.#columnDelete(change.columnId, change.moveCardsTo, actor);
      case "card-create":
        return this.#cardCreate(change, actor);
      case "card-update":
        return this.#cardUpdate(change.cardId, change.patch, actor);
      case "card-archive":
        return this.#cardArchive(change.cardId, change.archived, actor);
      case "card-delete": {
        const card = this.#card(change.cardId);
        this.#db.prepare("DELETE FROM board_cards WHERE id = ?").run(card.id);
        return this.#boardResult(card.boardId, actor, null);
      }
      case "card-move":
        return this.#cardMove(change.cardId, change.columnId, change.beforeCardId, actor);
    }
  }

  #stamp(): string {
    return this.#now().toISOString();
  }

  #cardCounts(): Map<string, number> {
    const counts = new Map<string, number>();
    for (const row of databaseRows(
      this.#db
        .prepare("SELECT column_id, COUNT(*) AS n FROM board_cards WHERE archived_at IS NULL GROUP BY column_id")
        .all(),
    ))
      counts.set(requiredStringColumn(row, "column_id"), requiredNumberColumn(row, "n"));
    return counts;
  }

  #boardRow(boardId: string): DynamicRecord {
    const row = databaseRow(this.#db.prepare("SELECT * FROM boards WHERE id = ?").get(boardId));
    if (!row) throw missing("error.boards.boardMissing");
    return row;
  }

  #columnRow(columnId: string): ColumnRow {
    const row = databaseRow(this.#db.prepare("SELECT * FROM board_columns WHERE id = ?").get(columnId));
    if (!row) throw missing("error.boards.columnMissing");
    return decodeColumn(row);
  }

  #columns(boardId: string): ColumnRow[] {
    return databaseRows(
      this.#db.prepare("SELECT * FROM board_columns WHERE board_id = ? ORDER BY position, id").all(boardId),
    ).map(decodeColumn);
  }

  #card(cardId: string): BoardCard {
    const row = databaseRow(this.#db.prepare("SELECT * FROM board_cards WHERE id = ?").get(cardId));
    if (!row) throw missing("error.boards.cardMissing");
    return decodeCard(row);
  }

  #summary(boardId: string): BoardSummary {
    return this.#summaryFrom(this.#boardRow(boardId), this.#columns(boardId), this.#cardCounts());
  }

  #summaryFrom(row: DynamicRecord, columns: readonly ColumnRow[], counts: ReadonlyMap<string, number>): BoardSummary {
    const color = optionalStringColumn(row, "color");
    const published: BoardColumn[] = columns.map((column) => ({
      id: column.id,
      name: column.name,
      position: column.position,
      done: column.done,
      cardCount: counts.get(column.id) ?? 0,
    }));
    return {
      id: requiredStringColumn(row, "id"),
      name: requiredStringColumn(row, "name"),
      description: requiredStringColumn(row, "description"),
      color: color !== null && isOneOf(BOARD_COLORS, color) ? color : null,
      position: requiredNumberColumn(row, "position"),
      archivedAt: optionalStringColumn(row, "archived_at"),
      createdBy: requiredStringColumn(row, "created_by"),
      createdAt: requiredStringColumn(row, "created_at"),
      updatedAt: requiredStringColumn(row, "updated_at"),
      updatedBy: actorOf(row, "updated_by_kind", "updated_by"),
      revision: requiredNumberColumn(row, "revision"),
      columns: published,
    };
  }

  #touch(boardId: string, actor: BoardActor): void {
    this.#db
      .prepare(
        "UPDATE boards SET revision = revision + 1, updated_at = ?, updated_by_kind = ?, updated_by = ? WHERE id = ?",
      )
      .run(this.#stamp(), actor.kind, actor.id, boardId);
  }

  #boardResult(boardId: string, actor: BoardActor, card: BoardCard | null = null): BoardMutation {
    this.#touch(boardId, actor);
    const board = this.#summary(boardId);
    return { boardId, revision: board.revision, board, card, deleted: false };
  }

  #boardCreate(change: Extract<BoardsChange, { kind: "board-create" }>, actor: BoardActor): BoardMutation {
    const total = requiredNumberColumn(
      databaseRow(this.#db.prepare("SELECT COUNT(*) AS n FROM boards").get()) ?? {},
      "n",
    );
    if (total >= BOARD_LIMITS.boards) throw refused("error.boards.tooManyBoards");
    const last = databaseRow(this.#db.prepare("SELECT MAX(position) AS position FROM boards").get());
    const lastPosition = last ? last.position : null;
    const position = typeof lastPosition === "number" ? lastPosition + BOARD_POSITION_STEP : 0;
    const id = newBoardId();
    const stamp = this.#stamp();
    this.#db
      .prepare(
        `INSERT INTO boards (id, name, description, color, position, created_by, created_at, updated_at,
           updated_by_kind, updated_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        id,
        change.name,
        change.description ?? "",
        change.color ?? null,
        position,
        actor.id,
        stamp,
        stamp,
        actor.kind,
        actor.id,
      );
    const insert = this.#db.prepare(
      "INSERT INTO board_columns (id, board_id, name, position, done) VALUES (?, ?, ?, ?, ?)",
    );
    change.columnNames.forEach((name, index) => {
      const done = change.columnNames.length > 1 && index === change.columnNames.length - 1;
      insert.run(newBoardId(), id, name, index, done ? 1 : 0);
    });
    const board = this.#summary(id);
    return { boardId: id, revision: board.revision, board, card: null, deleted: false };
  }

  #boardUpdate(change: Extract<BoardsChange, { kind: "board-update" }>, actor: BoardActor): BoardMutation {
    this.#boardRow(change.boardId);
    const sets: string[] = [];
    const values: SQLInputValue[] = [];
    if (change.name !== undefined) {
      sets.push("name = ?");
      values.push(change.name);
    }
    if (change.description !== undefined) {
      sets.push("description = ?");
      values.push(change.description);
    }
    if (change.color !== undefined) {
      sets.push("color = ?");
      values.push(change.color);
    }
    if (sets.length > 0)
      this.#db.prepare(`UPDATE boards SET ${sets.join(", ")} WHERE id = ?`).run(...values, change.boardId);
    return this.#boardResult(change.boardId, actor);
  }

  #boardDelete(boardId: string): BoardMutation {
    this.#boardRow(boardId);
    this.#db.prepare("DELETE FROM board_cards WHERE board_id = ?").run(boardId);
    this.#db.prepare("DELETE FROM board_columns WHERE board_id = ?").run(boardId);
    this.#db.prepare("DELETE FROM boards WHERE id = ?").run(boardId);
    return { boardId, revision: 0, board: null, card: null, deleted: true };
  }

  #columnCreate(change: Extract<BoardsChange, { kind: "column-create" }>, actor: BoardActor): BoardMutation {
    this.#boardRow(change.boardId);
    const columns = this.#columns(change.boardId);
    if (columns.length >= BOARD_LIMITS.columns) throw refused("error.boards.tooManyColumns");
    const position = columns.length === 0 ? 0 : Math.max(...columns.map((column) => column.position)) + 1;
    this.#db
      .prepare("INSERT INTO board_columns (id, board_id, name, position, done) VALUES (?, ?, ?, ?, ?)")
      .run(newBoardId(), change.boardId, change.name, position, change.done === true ? 1 : 0);
    return this.#boardResult(change.boardId, actor);
  }

  #columnUpdate(change: Extract<BoardsChange, { kind: "column-update" }>, actor: BoardActor): BoardMutation {
    const column = this.#columnRow(change.columnId);
    this.#db
      .prepare("UPDATE board_columns SET name = ?, done = ? WHERE id = ?")
      .run(change.name ?? column.name, (change.done ?? column.done) ? 1 : 0, column.id);
    return this.#boardResult(column.boardId, actor);
  }

  #columnMove(columnId: string, index: number, actor: BoardActor): BoardMutation {
    const column = this.#columnRow(columnId);
    const order = this.#columns(column.boardId).filter((candidate) => candidate.id !== columnId);
    order.splice(Math.min(index, order.length), 0, column);
    const update = this.#db.prepare("UPDATE board_columns SET position = ? WHERE id = ?");
    order.forEach((candidate, position) => {
      if (candidate.position !== position) update.run(position, candidate.id);
    });
    return this.#boardResult(column.boardId, actor);
  }

  #columnDelete(columnId: string, moveCardsTo: string | undefined, actor: BoardActor): BoardMutation {
    const column = this.#columnRow(columnId);
    const others = this.#columns(column.boardId).filter((candidate) => candidate.id !== columnId);
    if (others.length === 0) throw refused("error.boards.lastColumn");
    const active = requiredNumberColumn(
      databaseRow(
        this.#db
          .prepare("SELECT COUNT(*) AS n FROM board_cards WHERE column_id = ? AND archived_at IS NULL")
          .get(columnId),
      ) ?? {},
      "n",
    );
    let target = others[0];
    if (moveCardsTo !== undefined) {
      target = others.find((candidate) => candidate.id === moveCardsTo);
      if (!target) throw refused("error.boards.columnTarget");
    } else if (active > 0) throw refused("error.boards.columnNotEmpty");
    if (!target) throw refused("error.boards.columnTarget");
    const moving = databaseRows(
      this.#db.prepare("SELECT id, position FROM board_cards WHERE column_id = ? ORDER BY position, id").all(columnId),
    ).map(placed);
    const tail = databaseRow(
      this.#db.prepare("SELECT MAX(position) AS position FROM board_cards WHERE column_id = ?").get(target.id),
    );
    const base = tail && typeof tail.position === "number" ? tail.position : 0;
    const move = this.#db.prepare("UPDATE board_cards SET column_id = ?, position = ? WHERE id = ?");
    for (const [offset, card] of moving.entries()) {
      move.run(target.id, base + BOARD_POSITION_STEP * (offset + 1), card.id);
    }
    this.#db.prepare("DELETE FROM board_columns WHERE id = ?").run(columnId);
    return this.#boardResult(column.boardId, actor);
  }

  #activeCount(boardId: string): number {
    return requiredNumberColumn(
      databaseRow(
        this.#db
          .prepare("SELECT COUNT(*) AS n FROM board_cards WHERE board_id = ? AND archived_at IS NULL")
          .get(boardId),
      ) ?? {},
      "n",
    );
  }

  #endOfColumn(columnId: string): number {
    const row = databaseRow(
      this.#db
        .prepare("SELECT MAX(position) AS position FROM board_cards WHERE column_id = ? AND archived_at IS NULL")
        .get(columnId),
    );
    return row && typeof row.position === "number" ? row.position + BOARD_POSITION_STEP : 0;
  }

  #cardCreate(change: Extract<BoardsChange, { kind: "card-create" }>, actor: BoardActor): BoardMutation {
    this.#boardRow(change.boardId);
    const column = this.#columnRow(change.columnId);
    if (column.boardId !== change.boardId) throw refused("error.boards.columnTarget");
    if (this.#activeCount(change.boardId) >= BOARD_LIMITS.activeCards) throw refused("error.boards.tooManyCards");
    const id = newBoardId();
    const stamp = this.#stamp();
    this.#db
      .prepare(
        `INSERT INTO board_cards (id, board_id, column_id, position, title, description, assignee_kind, assignee_id,
           agent_id, thread_id, due_at, labels_json, created_by_kind, created_by, updated_by_kind, updated_by,
           created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        id,
        change.boardId,
        change.columnId,
        this.#endOfColumn(change.columnId),
        change.title,
        change.description ?? "",
        change.assignee?.kind ?? null,
        change.assignee?.id ?? null,
        change.thread?.agentId ?? null,
        change.thread?.threadId ?? null,
        change.dueAt ?? null,
        JSON.stringify(change.labels ?? []),
        actor.kind,
        actor.id,
        actor.kind,
        actor.id,
        stamp,
        stamp,
      );
    return this.#boardResult(change.boardId, actor, this.#card(id));
  }

  #cardUpdate(cardId: string, patch: BoardCardPatch, actor: BoardActor): BoardMutation {
    const card = this.#card(cardId);
    const sets: string[] = [];
    const values: SQLInputValue[] = [];
    const set = (column: string, value: SQLInputValue) => {
      sets.push(`${column} = ?`);
      values.push(value);
    };
    if (patch.title !== undefined) set("title", patch.title);
    if (patch.description !== undefined) set("description", patch.description);
    if (patch.assignee !== undefined) {
      set("assignee_kind", patch.assignee?.kind ?? null);
      set("assignee_id", patch.assignee?.id ?? null);
    }
    if (patch.thread !== undefined) {
      set("agent_id", patch.thread?.agentId ?? null);
      set("thread_id", patch.thread?.threadId ?? null);
    }
    if (patch.dueAt !== undefined) set("due_at", patch.dueAt);
    if (patch.labels !== undefined) set("labels_json", JSON.stringify(patch.labels));
    set("updated_at", this.#stamp());
    set("updated_by_kind", actor.kind);
    set("updated_by", actor.id);
    this.#db.prepare(`UPDATE board_cards SET ${sets.join(", ")} WHERE id = ?`).run(...values, card.id);
    return this.#boardResult(card.boardId, actor, this.#card(card.id));
  }

  #cardArchive(cardId: string, archived: boolean, actor: BoardActor): BoardMutation {
    const card = this.#card(cardId);
    if (archived) {
      this.#db
        .prepare(
          "UPDATE board_cards SET archived_at = ?, updated_at = ?, updated_by_kind = ?, updated_by = ? WHERE id = ?",
        )
        .run(this.#stamp(), this.#stamp(), actor.kind, actor.id, card.id);
    } else {
      if (card.archivedAt !== null && this.#activeCount(card.boardId) >= BOARD_LIMITS.activeCards)
        throw refused("error.boards.tooManyCards");
      this.#db
        .prepare(
          "UPDATE board_cards SET archived_at = NULL, position = ?, updated_at = ?, updated_by_kind = ?, updated_by = ? WHERE id = ?",
        )
        .run(this.#endOfColumn(card.columnId), this.#stamp(), actor.kind, actor.id, card.id);
    }
    return this.#boardResult(card.boardId, actor, this.#card(card.id));
  }

  #siblings(columnId: string, exceptCardId: string): Placed[] {
    return databaseRows(
      this.#db
        .prepare(
          "SELECT id, position FROM board_cards WHERE column_id = ? AND archived_at IS NULL AND id <> ? ORDER BY position, id",
        )
        .all(columnId, exceptCardId),
    ).map(placed);
  }

  #renumber(siblings: Placed[]): void {
    this.renumbers += 1;
    const update = this.#db.prepare("UPDATE board_cards SET position = ? WHERE id = ?");
    siblings.forEach((sibling, index) => {
      sibling.position = (index + 1) * BOARD_POSITION_STEP;
      update.run(sibling.position, sibling.id);
    });
  }

  #cardMove(cardId: string, columnId: string, beforeCardId: string | null, actor: BoardActor): BoardMutation {
    const card = this.#card(cardId);
    if (card.archivedAt !== null) throw missing("error.boards.cardMissing");
    const column = this.#columnRow(columnId);
    if (column.boardId !== card.boardId) throw refused("error.boards.columnTarget");
    if (beforeCardId === cardId)
      return {
        boardId: card.boardId,
        revision: this.#summary(card.boardId).revision,
        board: this.#summary(card.boardId),
        card,
        deleted: false,
      };
    const siblings = this.#siblings(columnId, cardId);
    const index =
      beforeCardId === null ? siblings.length : siblings.findIndex((sibling) => sibling.id === beforeCardId);
    if (index < 0) throw refused("error.boards.cardPlacement");
    let position = positionBetween(siblings[index - 1]?.position, siblings[index]?.position);
    if (position === null) {
      this.#renumber(siblings);
      position = positionBetween(siblings[index - 1]?.position, siblings[index]?.position) ?? 0;
    }
    this.#db
      .prepare(
        "UPDATE board_cards SET column_id = ?, position = ?, updated_at = ?, updated_by_kind = ?, updated_by = ? WHERE id = ?",
      )
      .run(columnId, position, this.#stamp(), actor.kind, actor.id, cardId);
    return this.#boardResult(card.boardId, actor, this.#card(cardId));
  }
}
