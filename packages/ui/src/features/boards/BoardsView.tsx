import { BOARD_LIMITS } from "@openbot/contracts/input-limits";
import type { BoardActor, BoardCard, BoardSummary } from "@openbot/contracts/ipc";
import { Archive, Button, Dialog, Input, Plus, Search, SquareKanban, Undo2 } from "@openbot/ui";
import { useText } from "@openbot/ui/text";
import { createMemo, createSignal, For, Show } from "solid-js";
import { BoardColumns } from "./BoardColumns";
import { NameDialog } from "./BoardsParts";
import { BoardsSidebar } from "./BoardsSidebar";
import { BoardsContext, type BoardsViewProps, useBoards } from "./boards-context";
import type { BoardsFilter } from "./boards-model";

function ArchivedCards(props: { board: BoardSummary; onClose: () => void }) {
  const { t } = useText();
  const { view } = useBoards();
  const [cards, setCards] = createSignal<BoardCard[] | null>(null);
  const load = () => {
    void view.archivedCards(props.board.id).then((list) => setCards(list ?? []));
  };
  load();
  return (
    <Dialog.Root open onOpenChange={(open: boolean) => !open && props.onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay class="ui-confirm-dialog-overlay">
          <Dialog.Content as="section" class="ui-confirm-dialog boards-name-dialog">
            <div class="boards-form">
              <Dialog.Title class="boards-form-title">{t("boards.archived.title")}</Dialog.Title>
              <Show
                when={cards()}
                fallback={
                  <p class="boards-hint" role="status">
                    {t("boards.loading")}
                  </p>
                }
              >
                {(list) => (
                  <Show when={list().length > 0} fallback={<p class="boards-hint">{t("boards.archived.empty")}</p>}>
                    <ul class="boards-archived-list">
                      <For each={list()}>
                        {(card) => (
                          <li class="boards-archived-row">
                            <span class="boards-archived-title">{card.title}</span>
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              onClick={async () => {
                                const result = await view.apply({
                                  kind: "card-archive",
                                  cardId: card.id,
                                  archived: false,
                                });
                                if (result !== null) load();
                              }}
                            >
                              <Undo2 aria-hidden="true" />
                              {t("boards.archived.restore")}
                            </Button>
                          </li>
                        )}
                      </For>
                    </ul>
                  </Show>
                )}
              </Show>
              <div class="boards-form-actions">
                <Button type="button" variant="ghost" onClick={() => props.onClose()}>
                  {t("boards.archived.close")}
                </Button>
              </div>
            </div>
          </Dialog.Content>
        </Dialog.Overlay>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function Main() {
  const { t } = useText();
  const { view } = useBoards();
  const [text, setText] = createSignal("");
  const [mine, setMine] = createSignal(false);
  const [archived, setArchived] = createSignal(false);
  const filter = createMemo<BoardsFilter>(() => ({ text: text(), mine: mine() }));
  const board = createMemo(() => view.boards.find((candidate) => candidate.id === view.selectedId) ?? null);
  const detail = () => (view.detail?.board.id === view.selectedId ? view.detail : null);
  return (
    <Show
      when={board()}
      fallback={
        <div class="boards-empty">
          <SquareKanban aria-hidden="true" />
          <p>{t("boards.choose")}</p>
        </div>
      }
    >
      {(current) => (
        <>
          <header class="boards-head">
            <h2 class="boards-title">{current().name}</h2>
            <div class="boards-tools">
              <div class="boards-search">
                <Search aria-hidden="true" />
                <Input
                  type="search"
                  value={text()}
                  aria-label={t("boards.filter.search")}
                  placeholder={t("boards.filter.search")}
                  onValueChange={setText}
                />
              </div>
              <Button
                type="button"
                size="sm"
                variant={mine() ? "secondary" : "ghost"}
                aria-pressed={mine() ? "true" : "false"}
                onClick={() => setMine(!mine())}
              >
                {t("boards.filter.mine")}
              </Button>
              <Button type="button" size="sm" variant="ghost" onClick={() => setArchived(true)}>
                <Archive aria-hidden="true" />
                {t("boards.archived.button")}
              </Button>
            </div>
          </header>
          <Show
            when={view.detailLoad !== "failed"}
            fallback={
              <div class="boards-empty" role="alert">
                <p>{t("boards.loadFailed")}</p>
                <Button type="button" onClick={() => view.onSelect(current().id)}>
                  {t("boards.retry")}
                </Button>
              </div>
            }
          >
            <Show
              when={detail()}
              fallback={
                <p class="boards-hint boards-status" role="status">
                  {t("boards.loading")}
                </p>
              }
            >
              {(loaded) => <BoardColumns board={loaded().board} cards={loaded().cards} filter={filter()} />}
            </Show>
          </Show>
          <Show when={archived()}>
            <ArchivedCards board={current()} onClose={() => setArchived(false)} />
          </Show>
        </>
      )}
    </Show>
  );
}

function Body() {
  const { t } = useText();
  const { view } = useBoards();
  const [creating, setCreating] = createSignal(false);
  return (
    <Show
      when={view.load === "ready"}
      fallback={
        <div class="boards-empty" role={view.load === "failed" ? "alert" : "status"}>
          <Show when={view.load === "failed"} fallback={<p>{t("boards.loading")}</p>}>
            <p>{t("boards.loadFailed")}</p>
            <Button type="button" onClick={() => view.onRetry()}>
              {t("boards.retry")}
            </Button>
          </Show>
        </div>
      }
    >
      <Show
        when={view.boards.length > 0}
        fallback={
          <div class="boards-empty">
            <SquareKanban aria-hidden="true" />
            <p>{t("boards.list.empty")}</p>
            <Button type="button" onClick={() => setCreating(true)}>
              <Plus aria-hidden="true" />
              {t("boards.list.new")}
            </Button>
            <Show when={creating()}>
              <NameDialog
                title={t("boards.board.newTitle")}
                label={t("boards.board.name")}
                initial=""
                submit={t("boards.board.create")}
                max={BOARD_LIMITS.boardName}
                onSubmit={async (name) => {
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
                }}
                onClose={() => setCreating(false)}
              />
            </Show>
          </div>
        }
      >
        <div class="boards-layout">
          <aside class="boards-side">
            <BoardsSidebar />
          </aside>
          <section class="boards-main">
            <Main />
          </section>
        </div>
      </Show>
    </Show>
  );
}

export function BoardsView(props: BoardsViewProps) {
  const { t } = useText();
  const actorName = (actor: BoardActor | null): string => {
    if (actor === null) return t("boards.dialog.nobody");
    const known =
      actor.kind === "member"
        ? props.members.find((member) => member.id === actor.id)?.name
        : props.agents.find((agent) => agent.id === actor.id)?.name;
    return known ?? t("boards.dialog.unknown");
  };
  return (
    <BoardsContext value={{ view: props, actorName }}>
      <section class="boards-view" aria-label={t("boards.page.title")}>
        <Body />
      </section>
    </BoardsContext>
  );
}
