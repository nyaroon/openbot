import type {
  BoardActor,
  BoardCard,
  BoardDetail,
  BoardMutation,
  BoardSummary,
  BoardsChange,
  BoardThreadLink,
} from "@openbot/contracts/ipc";
import { createContext, useContext } from "solid-js";
import type { BoardsAgent, BoardsLoad, BoardsMember, BoardsThread, CardPlacement } from "./boards-model";

export interface BoardsViewProps {
  load: BoardsLoad;
  boards: readonly BoardSummary[];
  selectedId: string | null;
  detail: BoardDetail | null;
  detailLoad: BoardsLoad;
  members: readonly BoardsMember[];
  agents: readonly BoardsAgent[];
  currentMemberId: string | null;
  canDelete: boolean;
  onSelect: (boardId: string | null) => void;
  onRetry: () => void;
  apply: (change: BoardsChange) => Promise<BoardMutation | null>;
  moveCard: (cardId: string, placement: CardPlacement) => Promise<boolean>;
  archivedCards: (boardId: string) => Promise<BoardCard[] | null>;
  threads: (agentId: string) => Promise<BoardsThread[]>;
  openThread: (link: BoardThreadLink) => void;
  hold: (cardId: string) => () => void;
}

export interface BoardsContextValue {
  view: BoardsViewProps;
  actorName: (actor: BoardActor | null) => string;
}

export const BoardsContext = createContext<BoardsContextValue>(undefined, { name: "Boards" });

export function useBoards(): BoardsContextValue {
  const value = useContext(BoardsContext);
  if (value === undefined) throw new Error("Boards context is missing.");
  return value;
}
