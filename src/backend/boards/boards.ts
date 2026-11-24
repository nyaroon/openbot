import { Effect } from "effect";
import type { OpenBotDatabase } from "../openbot-database";
import { BoardsError, type BoardsOperations } from "./boards-handle";
import { BoardsStore } from "./boards-store";

export interface BoardsDependencies {
  database: OpenBotDatabase;
  changed: (boardId: string) => void;
  now?: () => Date;
}

export type BoardsHandle = BoardsOperations;

function attempt<A>(work: () => A): Effect.Effect<A, BoardsError> {
  return Effect.try({ try: work, catch: (cause) => cause }).pipe(
    Effect.catch((cause) => (cause instanceof BoardsError ? Effect.fail(cause) : Effect.die(cause))),
  );
}

export function createBoards(dependencies: BoardsDependencies): BoardsHandle {
  const store = new BoardsStore(dependencies.database.connection, dependencies.now);
  return {
    list: () => attempt(() => store.list()),
    get: (input) => attempt(() => store.get(input.boardId)),
    archivedCards: (input) => attempt(() => store.archivedCards(input.boardId)),
    apply: (change, actor) =>
      attempt(() => store.apply(change, actor)).pipe(
        Effect.tap((result) => Effect.sync(() => dependencies.changed(result.boardId))),
      ),
  };
}
