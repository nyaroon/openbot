import { BOARD_LIMITS } from "@openbot/contracts/input-limits";
import type { BoardCard, BoardColumn, BoardSummary } from "@openbot/contracts/ipc";
import {
  Button,
  buttonVariants,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Dialog,
  DropdownMenu,
  Ellipsis,
  Input,
  MessageSquare,
  Plus,
} from "@openbot/ui";
import { useText } from "@openbot/ui/text";
import { createEffect, createMemo, createSignal, createUniqueId, For, Show, untrack } from "solid-js";
import { BoardCardDialog } from "./BoardCardDialog";
import { Avatar, BoardsPopupLayer, ChoiceSelect, NameDialog } from "./BoardsParts";
import { createBoardDrag } from "./board-drag";
import { useBoards } from "./boards-context";
import {
  type BoardsFilter,
  type CardPlacement,
  cardMatches,
  dateValue,
  filterActive,
  groupCards,
  isOverdue,
  localToday,
  placementIndex,
  sameColumnNeighbour,
} from "./boards-model";

interface Row {
  key: string;
  card: BoardCard | null;
}

type ColumnDialog = { kind: "rename"; column: BoardColumn } | { kind: "delete"; column: BoardColumn } | null;

function CardFooter(props: { card: BoardCard; done: boolean; today: string }) {
  const { t, format } = useText();
  const boards = useBoards();
  const overdue = () => isOverdue(props.card, props.today, props.done);
  const dueText = () => {
    const due = props.card.dueAt;
    if (due === null) return "";
    const date = format.date(dateValue(due), { dateStyle: "medium" });
    return overdue() ? t("boards.card.overdue", { date }) : t("boards.card.due", { date });
  };
  return (
    <Show when={props.card.assignee !== null || props.card.dueAt !== null || props.card.thread !== null}>
      <span class="boards-card-foot">
        <Show when={props.card.dueAt !== null}>
          <span class="boards-due" data-overdue={overdue() ? "" : undefined}>
            <Calendar aria-hidden="true" />
            {dueText()}
          </span>
        </Show>
        <Show when={props.card.thread !== null}>
          <span class="boards-thread-mark" role="img" aria-label={t("boards.card.thread")}>
            <MessageSquare aria-hidden="true" />
          </span>
        </Show>
        <Show when={props.card.assignee}>
          {(assignee) => (
            <span
              class="boards-assignee"
              role="img"
              aria-label={t("boards.card.assigned", { name: boards.actorName(assignee()) })}
              title={boards.actorName(assignee())}
            >
              <Avatar name={boards.actorName(assignee())} kind={assignee().kind} />
            </span>
          )}
        </Show>
      </span>
    </Show>
  );
}

function CardView(props: { card: BoardCard; done: boolean; today: string }) {
  return (
    <>
      <span class="boards-card-title">{props.card.title}</span>
      <Show when={props.card.labels.length > 0}>
        <span class="boards-card-labels">
          <For each={props.card.labels}>{(label) => <span class="boards-label-chip">{label}</span>}</For>
        </span>
      </Show>
      <CardFooter card={props.card} done={props.done} today={props.today} />
    </>
  );
}

function CardMenu(props: {
  card: BoardCard;
  columns: readonly BoardColumn[];
  cards: readonly BoardCard[];
  onOpen: () => void;
  onMove: (placement: CardPlacement) => void;
  onArchive: () => void;
}) {
  const { t } = useText();
  const up = () => sameColumnNeighbour(props.cards, props.card.id, "up");
  const down = () => sameColumnNeighbour(props.cards, props.card.id, "down");
  return (
    <DropdownMenu.Root placement="bottom-end" gutter={4}>
      <DropdownMenu.Trigger
        class={`${buttonVariants({ variant: "ghost", size: "icon-xs" })} boards-card-menu`}
        aria-label={t("boards.card.menu", { title: props.card.title })}
        data-no-drag=""
      >
        <Ellipsis aria-hidden="true" />
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content>
          <DropdownMenu.Item onSelect={props.onOpen}>{t("boards.dialog.title")}</DropdownMenu.Item>
          <DropdownMenu.Separator />
          <DropdownMenu.Item
            disabled={up() === null}
            onSelect={() => {
              const placement = up();
              if (placement !== null) props.onMove(placement);
            }}
          >
            {t("boards.card.moveUp")}
          </DropdownMenu.Item>
          <DropdownMenu.Item
            disabled={down() === null}
            onSelect={() => {
              const placement = down();
              if (placement !== null) props.onMove(placement);
            }}
          >
            {t("boards.card.moveDown")}
          </DropdownMenu.Item>
          <DropdownMenu.Sub>
            <DropdownMenu.SubTrigger>
              <span>{t("boards.card.moveTo")}</span>
              <ChevronRight aria-hidden="true" />
            </DropdownMenu.SubTrigger>
            <DropdownMenu.Portal>
              <DropdownMenu.SubContent class="ui-action-menu" aria-label={t("boards.card.moveTo")}>
                <For each={props.columns}>
                  {(column) => (
                    <DropdownMenu.Item
                      disabled={column.id === props.card.columnId}
                      onSelect={() => props.onMove({ columnId: column.id, beforeCardId: null })}
                    >
                      {column.name}
                    </DropdownMenu.Item>
                  )}
                </For>
              </DropdownMenu.SubContent>
            </DropdownMenu.Portal>
          </DropdownMenu.Sub>
          <DropdownMenu.Separator />
          <DropdownMenu.Item onSelect={props.onArchive}>{t("boards.card.archive")}</DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

function AddCard(props: { board: BoardSummary; column: BoardColumn }) {
  const { t } = useText();
  const boards = useBoards();
  const [open, setOpen] = createSignal(false);
  const [title, setTitle] = createSignal("");
  const [busy, setBusy] = createSignal(false);
  async function submit() {
    const text = title().trim();
    if (text === "" || busy()) return;
    setBusy(true);
    try {
      const result = await boards.view.apply({
        kind: "card-create",
        boardId: props.board.id,
        columnId: props.column.id,
        title: text,
      });
      if (result !== null) setTitle("");
    } finally {
      setBusy(false);
    }
  }
  return (
    <Show
      when={open()}
      fallback={
        <Button type="button" variant="ghost" size="sm" class="boards-add-card" onClick={() => setOpen(true)}>
          <Plus aria-hidden="true" />
          {t("boards.card.add")}
        </Button>
      }
    >
      <form
        class="boards-add-form"
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
        onKeyDown={(event) => {
          if (event.key !== "Escape") return;
          event.stopPropagation();
          setOpen(false);
          setTitle("");
        }}
      >
        <Input
          value={title()}
          maxlength={BOARD_LIMITS.cardTitle}
          autofocus
          aria-label={t("boards.card.title")}
          placeholder={t("boards.card.title")}
          onValueChange={setTitle}
        />
        <div class="boards-add-actions">
          <Button type="submit" size="sm" disabled={title().trim() === "" || busy()}>
            {t("boards.card.addSubmit")}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => {
              setOpen(false);
              setTitle("");
            }}
          >
            {t("common.cancel")}
          </Button>
        </div>
      </form>
    </Show>
  );
}

function ColumnMenu(props: {
  board: BoardSummary;
  column: BoardColumn;
  index: number;
  onDialog: (dialog: ColumnDialog) => void;
}) {
  const { t } = useText();
  const boards = useBoards();
  const columns = () => props.board.columns;
  return (
    <DropdownMenu.Root placement="bottom-end" gutter={4}>
      <DropdownMenu.Trigger
        class={buttonVariants({ variant: "ghost", size: "icon-xs" })}
        aria-label={t("boards.column.menu", { name: props.column.name })}
      >
        <Ellipsis aria-hidden="true" />
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content>
          <DropdownMenu.Item onSelect={() => props.onDialog({ kind: "rename", column: props.column })}>
            {t("boards.column.rename")}
          </DropdownMenu.Item>
          <DropdownMenu.Item
            onSelect={() =>
              void boards.view.apply({ kind: "column-update", columnId: props.column.id, done: !props.column.done })
            }
          >
            {props.column.done ? t("boards.column.unmarkDone") : t("boards.column.markDone")}
          </DropdownMenu.Item>
          <DropdownMenu.Item
            disabled={props.index === 0}
            onSelect={() =>
              void boards.view.apply({ kind: "column-move", columnId: props.column.id, index: props.index - 1 })
            }
          >
            <ChevronLeft aria-hidden="true" />
            {t("boards.column.moveLeft")}
          </DropdownMenu.Item>
          <DropdownMenu.Item
            disabled={props.index >= columns().length - 1}
            onSelect={() =>
              void boards.view.apply({ kind: "column-move", columnId: props.column.id, index: props.index + 1 })
            }
          >
            <ChevronRight aria-hidden="true" />
            {t("boards.column.moveRight")}
          </DropdownMenu.Item>
          <DropdownMenu.Separator />
          <DropdownMenu.Item
            disabled={columns().length <= 1}
            onSelect={() => props.onDialog({ kind: "delete", column: props.column })}
          >
            {t("boards.column.delete")}
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

function ColumnDeleteDialog(props: { board: BoardSummary; column: BoardColumn; count: number; onClose: () => void }) {
  const { t } = useText();
  const boards = useBoards();
  const others = createMemo(() => props.board.columns.filter((column) => column.id !== props.column.id));
  const [target, setTarget] = createSignal(others()[0]?.id ?? "");
  const [layer, setLayer] = createSignal<HTMLElement>();
  const [busy, setBusy] = createSignal(false);
  const labelId = createUniqueId();
  async function remove() {
    setBusy(true);
    try {
      const result = await boards.view.apply({
        kind: "column-delete",
        columnId: props.column.id,
        ...(props.count > 0 ? { moveCardsTo: target() } : {}),
      });
      if (result !== null) props.onClose();
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog.Root open onOpenChange={(open: boolean) => !open && props.onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay class="ui-confirm-dialog-overlay">
          <Dialog.Content as="section" class="ui-confirm-dialog boards-name-dialog" ref={setLayer}>
            <BoardsPopupLayer value={layer}>
              <div class="boards-form">
                <Dialog.Title class="boards-form-title">
                  {t("boards.column.deleteTitle", { name: props.column.name })}
                </Dialog.Title>
                <Dialog.Description class="boards-hint">
                  {props.count === 0
                    ? t("boards.column.deleteEmpty")
                    : t("boards.column.deleteMove", { count: props.count })}
                </Dialog.Description>
                <Show when={props.count > 0}>
                  <div class="ui-field">
                    <span class="ui-label" id={labelId}>
                      {t("boards.column.moveTo")}
                    </span>
                    <ChoiceSelect
                      options={others().map((column) => column.id)}
                      value={target()}
                      text={(id) => others().find((column) => column.id === id)?.name ?? id}
                      labelledBy={labelId}
                      onChange={setTarget}
                    />
                  </div>
                </Show>
                <div class="boards-form-actions">
                  <Button type="button" variant="ghost" onClick={() => props.onClose()}>
                    {t("common.cancel")}
                  </Button>
                  <Button type="button" variant="destructive" disabled={busy()} onClick={() => void remove()}>
                    {t("boards.column.delete")}
                  </Button>
                </div>
              </div>
            </BoardsPopupLayer>
          </Dialog.Content>
        </Dialog.Overlay>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export function BoardColumns(props: { board: BoardSummary; cards: readonly BoardCard[]; filter: BoardsFilter }) {
  const { t } = useText();
  const boards = useBoards();
  const view = boards.view;
  let scroller: HTMLDivElement | undefined;
  const [openCardId, setOpenCardId] = createSignal<string | null>(null);
  const [dialog, setDialog] = createSignal<ColumnDialog>(null);
  const [addingColumn, setAddingColumn] = createSignal(false);
  const [announcement, setAnnouncement] = createSignal("");
  const today = createMemo(() => localToday());
  const grouped = createMemo(() => groupCards(props.board.columns, props.cards));
  const openCard = createMemo(() => props.cards.find((card) => card.id === openCardId()) ?? null);
  const hintId = createUniqueId();

  function announce(card: BoardCard, placement: CardPlacement) {
    const column = props.board.columns.find((candidate) => candidate.id === placement.columnId);
    if (column === undefined) return;
    const target = untrack(grouped).get(column.id) ?? [];
    const position = placementIndex(target, card.id, placement.beforeCardId) + 1;
    const total = target.some((candidate) => candidate.id === card.id) ? target.length : target.length + 1;
    setAnnouncement(t("boards.card.moved", { title: card.title, column: column.name, position, total }));
  }

  async function move(card: BoardCard, placement: CardPlacement) {
    announce(card, placement);
    const moved = await view.moveCard(card.id, placement);
    if (!moved) setAnnouncement("");
  }

  const dnd = createBoardDrag({
    scroller: () => scroller,
    enabled: () => true,
    onDrop(cardId, placement) {
      const card = props.cards.find((candidate) => candidate.id === cardId);
      if (card === undefined) return;
      const same = placement.columnId === card.columnId;
      const column = grouped().get(card.columnId) ?? [];
      const index = column.findIndex((candidate) => candidate.id === cardId);
      const next = column[index + 1]?.id ?? null;
      if (same && placement.beforeCardId === next) return;
      void move(card, placement);
    },
    onCancel: () => setAnnouncement(t("boards.card.dragCancelled")),
  });
  const releaseWhileDragging = createMemo(() => dnd.drag()?.cardId ?? null);
  createEffect(releaseWhileDragging, (id) => (id === null ? undefined : view.hold(id)));

  const visible = (column: BoardColumn) =>
    (grouped().get(column.id) ?? []).filter((card) =>
      cardMatches(card, props.filter, view.currentMemberId, boards.actorName),
    );
  const anyVisible = createMemo(() => props.board.columns.some((column) => visible(column).length > 0));

  function rowsOf(column: BoardColumn): Row[] {
    const drag = dnd.drag();
    const gap = drag?.target?.columnId === column.id ? drag.target : null;
    const rows: Row[] = [];
    for (const card of visible(column)) {
      if (gap !== null && gap.beforeCardId === card.id) rows.push({ key: "gap", card: null });
      rows.push({ key: card.id, card });
    }
    if (gap !== null && !rows.some((row) => row.key === "gap")) rows.push({ key: "gap", card: null });
    return rows;
  }

  return (
    <>
      <Show when={filterActive(props.filter) && !anyVisible()}>
        <p class="boards-hint boards-filter-none" role="status">
          {t("boards.filter.none")}
        </p>
      </Show>
      <p id={hintId} class="sr-only">
        {t("boards.card.dragHint")}
      </p>
      <div class="sr-only" role="status" aria-live="polite">
        {announcement()}
      </div>
      {/* biome-ignore lint/a11y/useSemanticElements: a scroll region of columns, not a form group */}
      <div class="boards-columns" ref={scroller} role="group" aria-label={props.board.name}>
        <For each={props.board.columns}>
          {(column, index) => {
            const headingId = createUniqueId();
            const cards = () => grouped().get(column.id) ?? [];
            return (
              <section
                class="boards-column"
                data-board-column={column.id}
                data-done={column.done ? "" : undefined}
                aria-labelledby={headingId}
              >
                <header class="boards-column-head">
                  <h3 id={headingId} class="boards-column-name">
                    {column.name}
                  </h3>
                  <span class="boards-column-count" title={t("boards.list.cards", { count: cards().length })}>
                    {cards().length}
                  </span>
                  <ColumnMenu board={props.board} column={column} index={index()} onDialog={setDialog} />
                </header>
                <ul class="boards-cards" data-board-column-body="" aria-labelledby={headingId}>
                  <For each={rowsOf(column)} keyed={(row) => row.key}>
                    {(row) => (
                      <Show when={row().card} fallback={<li class="boards-gap" aria-hidden="true" />}>
                        {(card) => (
                          <li
                            class="boards-card"
                            data-board-card={card().id}
                            hidden={dnd.drag()?.cardId === card().id}
                            onPointerDown={(event: PointerEvent & { currentTarget: HTMLLIElement }) => {
                              const target = event.target;
                              if (target instanceof Element && target.closest("[data-no-drag]")) return;
                              dnd.begin(event, card().id, event.currentTarget);
                            }}
                          >
                            <Button
                              type="button"
                              variant="ghost"
                              class="boards-card-main"
                              aria-describedby={hintId}
                              onClick={() => {
                                if (!dnd.clickSuppressed()) setOpenCardId(card().id);
                              }}
                            >
                              <CardView card={card()} done={column.done} today={today()} />
                            </Button>
                            <CardMenu
                              card={card()}
                              columns={props.board.columns}
                              cards={cards()}
                              onOpen={() => setOpenCardId(card().id)}
                              onMove={(placement) => void move(card(), placement)}
                              onArchive={() =>
                                void view.apply({ kind: "card-archive", cardId: card().id, archived: true })
                              }
                            />
                          </li>
                        )}
                      </Show>
                    )}
                  </For>
                  <Show when={cards().length === 0 && dnd.drag()?.target?.columnId !== column.id}>
                    <li class="boards-column-empty">{t("boards.column.empty")}</li>
                  </Show>
                </ul>
                <AddCard board={props.board} column={column} />
              </section>
            );
          }}
        </For>
        <div class="boards-add-column">
          <Show
            when={props.board.columns.length < BOARD_LIMITS.columns}
            fallback={<p class="boards-hint">{t("boards.column.limit", { count: BOARD_LIMITS.columns })}</p>}
          >
            <Button type="button" variant="ghost" size="sm" onClick={() => setAddingColumn(true)}>
              <Plus aria-hidden="true" />
              {t("boards.column.add")}
            </Button>
          </Show>
        </div>
      </div>
      <Show when={dnd.drag()}>
        {(drag) => (
          <div
            class="boards-ghost"
            aria-hidden="true"
            style={{
              "--ghost-x": `${drag().x - drag().offsetX}px`,
              "--ghost-y": `${drag().y - drag().offsetY}px`,
              width: `${drag().width}px`,
            }}
          >
            {props.cards.find((card) => card.id === drag().cardId)?.title}
          </div>
        )}
      </Show>
      <Show when={openCard()}>
        {(card) => <BoardCardDialog board={props.board} card={card()} onClose={() => setOpenCardId(null)} />}
      </Show>
      <Show when={addingColumn()}>
        <NameDialog
          title={t("boards.column.add")}
          label={t("boards.column.name")}
          initial=""
          submit={t("boards.column.add")}
          max={BOARD_LIMITS.columnName}
          onSubmit={async (name) =>
            (await view.apply({ kind: "column-create", boardId: props.board.id, name })) !== null
          }
          onClose={() => setAddingColumn(false)}
        />
      </Show>
      <Show when={dialog()}>
        {(current) => (
          <Show
            when={current().kind === "rename"}
            fallback={
              <ColumnDeleteDialog
                board={props.board}
                column={current().column}
                count={(grouped().get(current().column.id) ?? []).length}
                onClose={() => setDialog(null)}
              />
            }
          >
            <NameDialog
              title={t("boards.column.rename")}
              label={t("boards.column.name")}
              initial={current().column.name}
              submit={t("boards.dialog.save")}
              max={BOARD_LIMITS.columnName}
              onSubmit={async (name) =>
                (await view.apply({ kind: "column-update", columnId: current().column.id, name })) !== null
              }
              onClose={() => setDialog(null)}
            />
          </Show>
        )}
      </Show>
    </>
  );
}
