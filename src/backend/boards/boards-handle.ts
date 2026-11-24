import type {
  BoardActor,
  BoardArchivedCards,
  BoardDetail,
  BoardIdInput,
  BoardList,
  BoardMutation,
  BoardsChange,
} from "@openbot/contracts/ipc";
import { type Effect, Schema } from "effect";

export class BoardsError extends Schema.TaggedError<BoardsError>()("BoardsError", {
  code: Schema.Literals(["missing", "refused"]),
  message: Schema.String,
}) {}

export interface BoardsOperations {
  list(): Effect.Effect<BoardList, BoardsError>;
  get(input: BoardIdInput): Effect.Effect<BoardDetail, BoardsError>;
  archivedCards(input: BoardIdInput): Effect.Effect<BoardArchivedCards, BoardsError>;
  apply(change: BoardsChange, actor: BoardActor): Effect.Effect<BoardMutation, BoardsError>;
}
