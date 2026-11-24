import { BOARD_LIMITS } from "@openbot/contracts/input-limits";
import type { BoardSummary } from "@openbot/contracts/ipc";
import { Button, buttonVariants, ConfirmDialog, DropdownMenu, Ellipsis, Plus, SquareKanban } from "@openbot/ui";
import { useText } from "@openbot/ui/text";
import { createMemo, createSignal, For, Show } from "solid-js";
import { NameDialog } from "./BoardsParts";
import { useBoards } from "./boards-context";

type BoardDialog = { kind: "new" } | { kind: "rename"; board: BoardSummary } | { kind: "delete"; board: BoardSummary };

function cardTotal(board: BoardSummary): number {
  return board.columns.reduce((total, column) => total + column.cardCount, 0);
}

function BoardMenu(props: { board: BoardSummary; onDialog: (dialog: BoardDialog) => void }) {
  const { t } = useText();
  const { view } = useBoards();
  return (
    <DropdownMenu.Root placement="bottom-end" gutter={4}>
      <DropdownMenu.Trigger
        class={`${buttonVariants({ variant: "ghost", size: "icon-xs" })} boards-board-menu`}
        aria-label={t("boards.board.menu", { name: props.board.name })}
      >
        <Ellipsis aria-hidden="true" />
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content>
          <DropdownMenu.Item onSelect={() => props.onDialog({ kind: "rename", board: props.board })}>
            {t("boards.board.rename")}
          </DropdownMenu.Item>
          <DropdownMenu.Item
            onSelect={() =>
              void view.apply({
                kind: "board-archive",
                boardId: props.board.id,
                archived: props.board.archivedAt === null,
              })
            }
          >
            {props.board.archivedAt === null ? t("boards.board.archive") : t("boards.board.restore")}
          </DropdownMenu.Item>
          <Show when={view.canDelete}>
            <DropdownMenu.Separator />
            <DropdownMenu.Item onSelect={() => props.onDialog({ kind: "delete", board: props.board })}>
              {t("boards.board.delete")}
            </DropdownMenu.Item>
          </Show>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

function BoardRow(props: { board: BoardSummary; onDialog: (dialog: BoardDialog) => void }) {
  const { t } = useText();
  const { view } = useBoards();
  const selected = () => view.selectedId === props.board.id;
  return (
    <li class="boards-side-row" data-selected={selected() ? "" : undefined}>
      <Button
        type="button"
        variant="ghost"
        class="boards-side-item"
        aria-current={selected() ? "true" : undefined}
        onClick={() => view.onSelect(props.board.id)}
      >
        <SquareKanban aria-hidden="true" />
        <span class="boards-side-name">{props.board.name}</span>
        <span class="boards-side-count" title={t("boards.list.cards", { count: cardTotal(props.board) })}>
          {cardTotal(props.board)}
        </span>
      </Button>
      <BoardMenu board={props.board} onDialog={props.onDialog} />
    </li>
  );
}

export function BoardsSidebar() {
  const { t } = useText();
  const { view } = useBoards();
  const [dialog, setDialog] = createSignal<BoardDialog | null>(null);
  const active = createMemo(() => view.boards.filter((board) => board.archivedAt === null));
  const archived = createMemo(() => view.boards.filter((board) => board.archivedAt !== null));
  const full = () => active().length + archived().length >= BOARD_LIMITS.boards;
  async function create(name: string): Promise<boolean> {
    const result = await view.apply({
      kind: "board-create",
      name,
      columnNames: [
        t("boards.column.todo"),
        t("boards.column.doing"),
        t("boards.column.review"),
        t("boards.column.done"),
      ],
    });
    if (result?.board) view.onSelect(result.board.id);
    return result !== null;
  }
  return (
    <nav class="boards-side-nav" aria-label={t("boards.list.label")}>
      <div class="boards-side-head">
        <h2 class="boards-side-title">{t("boards.list.label")}</h2>
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          class="boards-side-new"
          aria-label={t("boards.list.new")}
          title={t("boards.list.new")}
          disabled={full()}
          onClick={() => setDialog({ kind: "new" })}
        >
          <Plus aria-hidden="true" />
        </Button>
      </div>
      <ul class="boards-side-list">
        <For each={active()}>{(board) => <BoardRow board={board} onDialog={setDialog} />}</For>
      </ul>
      <Show when={archived().length > 0}>
        <details class="boards-side-archived">
          <summary>{t("boards.list.archived")}</summary>
          <ul class="boards-side-list">
            <For each={archived()}>{(board) => <BoardRow board={board} onDialog={setDialog} />}</For>
          </ul>
        </details>
      </Show>
      <Show when={dialog()}>
        {(current) => (
          <>
            <Show when={current().kind === "new"}>
              <NameDialog
                title={t("boards.board.newTitle")}
                label={t("boards.board.name")}
                initial=""
                submit={t("boards.board.create")}
                max={BOARD_LIMITS.boardName}
                onSubmit={create}
                onClose={() => setDialog(null)}
              />
            </Show>
            <Show when={current().kind === "rename" ? current() : null}>
              {(rename) => (
                <NameDialog
                  title={t("boards.board.renameTitle")}
                  label={t("boards.board.name")}
                  initial={renameName(rename())}
                  submit={t("boards.dialog.save")}
                  max={BOARD_LIMITS.boardName}
                  onSubmit={async (name) =>
                    (await view.apply({ kind: "board-update", boardId: boardOf(rename()).id, name })) !== null
                  }
                  onClose={() => setDialog(null)}
                />
              )}
            </Show>
            <Show when={current().kind === "delete" ? current() : null}>
              {(removing) => (
                <ConfirmDialog
                  open
                  tone="destructive"
                  title={t("boards.board.deleteTitle", { name: boardOf(removing()).name })}
                  description={t("boards.board.deleteBody", { count: cardTotal(boardOf(removing())) })}
                  confirmLabel={t("boards.board.delete")}
                  onCancel={() => setDialog(null)}
                  onConfirm={async () => {
                    const board = boardOf(removing());
                    setDialog(null);
                    await view.apply({ kind: "board-delete", boardId: board.id });
                  }}
                />
              )}
            </Show>
          </>
        )}
      </Show>
    </nav>
  );
}

function boardOf(dialog: BoardDialog): BoardSummary {
  if (dialog.kind === "new") throw new Error("No board for a new-board dialog.");
  return dialog.board;
}

function renameName(dialog: BoardDialog): string {
  return dialog.kind === "new" ? "" : dialog.board.name;
}
