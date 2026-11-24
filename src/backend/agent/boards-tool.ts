import { BOARD_LIMITS, INPUT_LIMITS } from "@openbot/contracts/input-limits";
import type { BoardActor, BoardCard, BoardDetail, BoardSummary } from "@openbot/contracts/ipc";
import { Effect } from "effect";
import { z } from "zod";
import type { BoardsOperations } from "../boards/boards-handle";
import { openBotToolFailure, openBotToolResult } from "./routine-tools";
import { toolStep } from "./tool-operation";

const id = z.string().min(1).max(INPUT_LIMITS.identifier);
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/u, "Use YYYY-MM-DD.");
const assignee = z.strictObject({ kind: z.enum(["member", "agent"]), id });
const labels = z.array(z.string().trim().min(1).max(BOARD_LIMITS.label)).max(BOARD_LIMITS.labels);
const title = z.string().trim().min(1).max(BOARD_LIMITS.cardTitle);
const description = z.string().max(BOARD_LIMITS.cardDescription);
const column = z.string().trim().min(1).max(INPUT_LIMITS.identifier).describe("column name or id");

const listSchema = z.strictObject({});
const getSchema = z.strictObject({ boardId: id });
const createSchema = z.strictObject({
  boardId: id,
  column: column.optional().describe("defaults to the first column"),
  title,
  description: description.optional(),
  assignee: assignee.optional(),
  dueAt: date.optional(),
  labels: labels.optional(),
});
const updateSchema = z.strictObject({
  cardId: id,
  title: title.optional(),
  description: description.optional(),
  assignee: assignee.nullable().optional(),
  dueAt: date.nullable().optional(),
  labels: labels.optional(),
});
const moveSchema = z.strictObject({
  boardId: id,
  cardId: id,
  column,
  beforeCardId: id.nullable().optional().describe("place before this card; omit to place last"),
});

export const BOARDS_TOOL_DEFINITIONS = [
  {
    name: "list_boards",
    description: "List the project boards of this server with their columns and how many cards each column holds.",
    shape: listSchema.shape,
  },
  {
    name: "get_board",
    description: "Read one project board: its columns and active cards with id, title, assignee, due date and labels.",
    shape: getSchema.shape,
  },
  {
    name: "create_board_card",
    description: "Add a card to a column of a project board. The card records that this agent created it.",
    shape: createSchema.shape,
  },
  {
    name: "update_board_card",
    description:
      "Change a board card's title, description, assignee, due date or labels. Omitted fields stay as they are.",
    shape: updateSchema.shape,
  },
  {
    name: "move_board_card",
    description: "Move a board card to a column, by column name or id, optionally before another card.",
    shape: moveSchema.shape,
  },
] as const;

export const BOARDS_TOOL_NAMES: ReadonlySet<string> = new Set(BOARDS_TOOL_DEFINITIONS.map((tool) => tool.name));

function compactBoard(board: BoardSummary) {
  return {
    id: board.id,
    name: board.name,
    archived: board.archivedAt !== null,
    columns: board.columns.map((entry) => ({
      id: entry.id,
      name: entry.name,
      done: entry.done,
      cards: entry.cardCount,
    })),
  };
}

function compactCard(card: BoardCard) {
  return {
    id: card.id,
    title: card.title,
    ...(card.description ? { description: card.description.slice(0, 300) } : {}),
    ...(card.assignee ? { assignee: `${card.assignee.kind}:${card.assignee.id}` } : {}),
    ...(card.dueAt ? { dueAt: card.dueAt } : {}),
    ...(card.labels.length > 0 ? { labels: card.labels } : {}),
    ...(card.thread ? { thread: card.thread } : {}),
  };
}

function compactDetail(detail: BoardDetail) {
  return {
    id: detail.board.id,
    name: detail.board.name,
    columns: detail.board.columns.map((entry) => ({
      id: entry.id,
      name: entry.name,
      done: entry.done,
      cards: detail.cards.filter((card) => card.columnId === entry.id).map(compactCard),
    })),
  };
}

function resolveColumn(board: BoardSummary, reference: string): string | null {
  const wanted = reference.trim().toLowerCase();
  return (
    board.columns.find((entry) => entry.id === reference)?.id ??
    board.columns.find((entry) => entry.name.trim().toLowerCase() === wanted)?.id ??
    null
  );
}

const NO_COLUMN = "That column does not exist. Read the board with openbot.get_board.";
const NO_AGENT = "That agent does not exist. Use an id from openbot.list_agents.";

export const handleBoardsTool = Effect.fn("BoardsTools.handle")(function* (
  tool: string,
  args: unknown,
  boards: BoardsOperations | null,
  agentId: string,
  knownAgent: (agentId: string) => boolean,
  redact: (text: string) => string,
) {
  if (!BOARDS_TOOL_NAMES.has(tool)) return null;
  if (!boards) return openBotToolFailure("Boards are unavailable.");
  const actor: BoardActor = { kind: "agent", id: agentId };

  const operation = Effect.gen(function* () {
    if (tool === "list_boards") {
      yield* toolStep(() => listSchema.parse(args ?? {}));
      const result = yield* boards.list();
      return openBotToolResult({ boards: result.boards.filter((board) => !board.archivedAt).map(compactBoard) });
    }
    if (tool === "get_board") {
      const input = yield* toolStep(() => getSchema.parse(args));
      return openBotToolResult(compactDetail(yield* boards.get({ boardId: input.boardId })));
    }
    if (tool === "create_board_card") {
      const input = yield* toolStep(() => createSchema.parse(args));
      if (input.assignee?.kind === "agent" && !knownAgent(input.assignee.id)) return openBotToolFailure(NO_AGENT);
      const detail = yield* boards.get({ boardId: input.boardId });
      const target = input.column ? resolveColumn(detail.board, input.column) : (detail.board.columns[0]?.id ?? null);
      if (!target) return openBotToolFailure(NO_COLUMN);
      const result = yield* boards.apply(
        {
          kind: "card-create",
          boardId: input.boardId,
          columnId: target,
          title: input.title,
          ...(input.description !== undefined ? { description: input.description } : {}),
          ...(input.assignee ? { assignee: input.assignee } : {}),
          ...(input.dueAt ? { dueAt: input.dueAt } : {}),
          ...(input.labels ? { labels: input.labels } : {}),
        },
        actor,
      );
      return openBotToolResult({ card: result.card ? compactCard(result.card) : null });
    }
    if (tool === "update_board_card") {
      const input = yield* toolStep(() => updateSchema.parse(args));
      if (input.assignee?.kind === "agent" && !knownAgent(input.assignee.id)) return openBotToolFailure(NO_AGENT);
      const result = yield* boards.apply(
        {
          kind: "card-update",
          cardId: input.cardId,
          patch: {
            ...(input.title !== undefined ? { title: input.title } : {}),
            ...(input.description !== undefined ? { description: input.description } : {}),
            ...(input.assignee !== undefined ? { assignee: input.assignee } : {}),
            ...(input.dueAt !== undefined ? { dueAt: input.dueAt } : {}),
            ...(input.labels !== undefined ? { labels: input.labels } : {}),
          },
        },
        actor,
      );
      return openBotToolResult({ card: result.card ? compactCard(result.card) : null });
    }
    const input = yield* toolStep(() => moveSchema.parse(args));
    const detail = yield* boards.get({ boardId: input.boardId });
    const target = resolveColumn(detail.board, input.column);
    if (!target) return openBotToolFailure(NO_COLUMN);
    const result = yield* boards.apply(
      { kind: "card-move", cardId: input.cardId, columnId: target, beforeCardId: input.beforeCardId ?? null },
      actor,
    );
    return openBotToolResult({ card: result.card ? compactCard(result.card) : null });
  });

  return yield* operation.pipe(
    Effect.catchTag("BoardsError", (failure) => Effect.succeed(openBotToolFailure(redact(failure.message)))),
  );
});
