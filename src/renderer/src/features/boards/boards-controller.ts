import type { BoardCard, BoardDetail, BoardMutation, BoardSummary, BoardsChange } from "@openbot/contracts/ipc";
import { toast } from "@openbot/ui";
import type { BoardsViewProps } from "@openbot/ui/features/boards/boards-context";
import { type CardPlacement, cardOrder, moveCardLocally } from "@openbot/ui/features/boards/boards-model";
import { useText } from "@openbot/ui/text";
import { createSignal, createStore, onCleanup, reconcile } from "solid-js";
import type { BoardsHost } from "./boards-port";

const SELECTED_KEY = "openbot:boards-selected:";
const CHANGE_DELAY_MS = 150;

function readSelected(serverId: string): string | null {
  try {
    return window.localStorage.getItem(SELECTED_KEY + serverId);
  } catch {
    return null;
  }
}

function writeSelected(serverId: string, boardId: string | null): void {
  try {
    if (boardId === null) window.localStorage.removeItem(SELECTED_KEY + serverId);
    else window.localStorage.setItem(SELECTED_KEY + serverId, boardId);
  } catch {}
}

type BoardsController = Pick<
  BoardsViewProps,
  | "load"
  | "boards"
  | "selectedId"
  | "detail"
  | "detailLoad"
  | "onSelect"
  | "onRetry"
  | "apply"
  | "moveCard"
  | "archivedCards"
  | "hold"
>;

export function createBoardsController(host: BoardsHost, serverId: string): BoardsController {
  const { t, errorMessage } = useText();
  const [list, setList] = createStore<{ value: BoardSummary[] }>({ value: [] });
  const [open, setOpen] = createStore<{ value: BoardDetail | null }>({ value: null });
  const [load, setLoad] = createSignal<BoardsViewProps["load"]>("loading");
  const [detailLoad, setDetailLoad] = createSignal<BoardsViewProps["detailLoad"]>("loading");
  const [selectedId, setSelectedId] = createSignal<string | null>(readSelected(serverId));
  const held = new Map<string, number>();
  let listRun = 0;
  let detailRun = 0;
  let disposed = false;
  let timer: ReturnType<typeof setTimeout> | undefined;

  const fail = (error: unknown) => toast.error(errorMessage(error, t("boards.failed")));

  function pickSelection(boards: readonly BoardSummary[]): string | null {
    const current = selectedId();
    if (current !== null && boards.some((board) => board.id === current)) return current;
    return boards.find((board) => board.archivedAt === null)?.id ?? null;
  }

  function setSelection(boardId: string | null): void {
    setSelectedId(boardId);
    writeSelected(serverId, boardId);
  }

  function mergeDetail(next: BoardDetail): BoardDetail {
    const current = open.value;
    if (current === null || current.board.id !== next.board.id || held.size === 0) return next;
    const keep = current.cards.filter((card) => held.has(card.id));
    if (keep.length === 0) return next;
    const kept = new Set(keep.map((card) => card.id));
    const others = next.cards.filter((card) => !kept.has(card.id));
    const present = keep.filter((card) => next.cards.some((candidate) => candidate.id === card.id));
    return { board: next.board, cards: [...others, ...present.map((card) => ({ ...card }))] };
  }

  async function loadDetail(boardId: string): Promise<void> {
    const run = ++detailRun;
    try {
      const next = await host.get(boardId);
      if (disposed || run !== detailRun || selectedId() !== boardId) return;
      setOpen(reconcile({ value: mergeDetail(next) }, "id"));
      setDetailLoad("ready");
    } catch (error) {
      if (disposed || run !== detailRun) return;
      setDetailLoad("failed");
      fail(error);
      void loadList();
    }
  }

  async function loadList(): Promise<void> {
    const run = ++listRun;
    try {
      const { boards } = await host.list();
      if (disposed || run !== listRun) return;
      const selection = pickSelection(boards);
      const changed = selection !== selectedId();
      if (changed) setSelection(selection);
      setList(reconcile({ value: boards }, "id"));
      setLoad("ready");
      if (selection === null) {
        setOpen((draft) => {
          draft.value = null;
        });
      } else if (changed || open.value === null || open.value.board.id !== selection) {
        void loadDetail(selection);
      }
    } catch (error) {
      if (disposed || run !== listRun) return;
      if (load() === "loading") {
        setLoad("failed");
      } else {
        fail(error);
      }
    }
  }

  function reload(boardId: string | null): void {
    void loadList();
    const selected = selectedId();
    if (selected !== null && (boardId === null || boardId === selected)) void loadDetail(selected);
  }

  const stop = host.onChanged((boardId) => {
    clearTimeout(timer);
    timer = setTimeout(() => reload(boardId), CHANGE_DELAY_MS);
  });
  onCleanup(() => {
    disposed = true;
    clearTimeout(timer);
    stop();
  });
  void loadList();

  function upsertCard(card: BoardCard): void {
    setOpen((draft) => {
      const detail = draft.value;
      if (detail === null || detail.board.id !== card.boardId) return;
      const index = detail.cards.findIndex((candidate) => candidate.id === card.id);
      if (card.archivedAt !== null) {
        if (index >= 0) detail.cards.splice(index, 1);
      } else if (index >= 0) {
        detail.cards[index] = card;
      } else {
        detail.cards.push(card);
      }
    });
  }

  function absorb(result: BoardMutation): void {
    if (result.deleted && result.board === null && result.card === null) {
      const boardId = result.boardId;
      setList((draft) => {
        draft.value = draft.value.filter((board) => board.id !== boardId);
      });
      if (selectedId() === boardId) {
        setSelection(pickSelection(list.value));
        setOpen((draft) => {
          draft.value = null;
        });
        const next = selectedId();
        if (next !== null) void loadDetail(next);
      }
      return;
    }
    if (result.deleted && result.card !== null) {
      const cardId = result.card.id;
      setOpen((draft) => {
        if (draft.value === null) return;
        draft.value.cards = draft.value.cards.filter((card) => card.id !== cardId);
      });
    } else if (result.card !== null) {
      upsertCard(result.card);
    }
    const board = result.board;
    if (board !== null) {
      setList((draft) => {
        const index = draft.value.findIndex((candidate) => candidate.id === board.id);
        if (index >= 0) draft.value[index] = board;
        else draft.value.push(board);
      });
      setOpen((draft) => {
        if (draft.value?.board.id === board.id) draft.value.board = board;
      });
    }
  }

  async function apply(change: BoardsChange): Promise<BoardMutation | null> {
    try {
      const result = await host.apply(change);
      if (!disposed) absorb(result);
      return result;
    } catch (error) {
      fail(error);
      return null;
    } finally {
      if (!disposed) {
        clearTimeout(timer);
        timer = setTimeout(() => reload(null), CHANGE_DELAY_MS);
      }
    }
  }

  function hold(cardId: string): () => void {
    held.set(cardId, (held.get(cardId) ?? 0) + 1);
    return () => {
      const left = (held.get(cardId) ?? 1) - 1;
      if (left <= 0) held.delete(cardId);
      else held.set(cardId, left);
    };
  }

  async function moveCard(cardId: string, placement: CardPlacement): Promise<boolean> {
    const detail = open.value;
    const before = detail?.cards.find((card) => card.id === cardId);
    if (detail === null || before === undefined) return false;
    const previous = { columnId: before.columnId, position: before.position };
    const release = hold(cardId);
    const moved = moveCardLocally(detail.cards, cardId, placement).find((card) => card.id === cardId);
    if (moved !== undefined) {
      setOpen((draft) => {
        const card = draft.value?.cards.find((candidate) => candidate.id === cardId);
        if (card === undefined) return;
        card.columnId = moved.columnId;
        card.position = moved.position;
      });
    }
    try {
      const result = await host.apply({
        kind: "card-move",
        cardId,
        columnId: placement.columnId,
        beforeCardId: placement.beforeCardId,
      });
      if (!disposed) absorb(result);
      return true;
    } catch (error) {
      if (!disposed) {
        setOpen((draft) => {
          const card = draft.value?.cards.find((candidate) => candidate.id === cardId);
          if (card === undefined) return;
          card.columnId = previous.columnId;
          card.position = previous.position;
        });
        fail(error);
      }
      return false;
    } finally {
      release();
      if (!disposed) {
        clearTimeout(timer);
        timer = setTimeout(() => reload(null), CHANGE_DELAY_MS);
      }
    }
  }

  return {
    get load() {
      return load();
    },
    get boards() {
      return list.value;
    },
    get selectedId() {
      return selectedId();
    },
    get detail() {
      return open.value;
    },
    get detailLoad() {
      return detailLoad();
    },
    onSelect(boardId) {
      if (boardId === selectedId() && open.value?.board.id === boardId && detailLoad() !== "failed") return;
      setSelection(boardId);
      if (open.value?.board.id !== boardId) {
        setOpen((draft) => {
          draft.value = null;
        });
      }
      setDetailLoad("loading");
      if (boardId !== null) void loadDetail(boardId);
    },
    onRetry() {
      setLoad("loading");
      void loadList();
    },
    apply,
    moveCard,
    async archivedCards(boardId) {
      try {
        return [...(await host.archivedCards(boardId)).cards].sort(cardOrder);
      } catch (error) {
        fail(error);
        return null;
      }
    },
    hold,
  };
}
