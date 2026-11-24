import { BOARD_LIMITS } from "@openbot/contracts/input-limits";
import type { BoardActor, BoardCard, BoardCardPatch, BoardSummary, BoardThreadLink } from "@openbot/contracts/ipc";
import {
  Archive,
  Button,
  ConfirmDialog,
  Dialog,
  Field,
  IconButton,
  Input,
  Link2,
  Link2Off,
  MessageSquare,
  Textarea,
  Trash2,
  X,
} from "@openbot/ui";
import { useText } from "@openbot/ui/text";
import type { JSX } from "@solidjs/web";
import { createEffect, createMemo, createSignal, createStore, createUniqueId, For, onCleanup, Show } from "solid-js";
import { Avatar, BoardsPopupLayer, ChoiceSelect } from "./BoardsParts";
import { useBoards } from "./boards-context";
import { actorKey, actorOfKey, type BoardsThread, parseLabels } from "./boards-model";

const NONE = "none";

interface Draft {
  title: string;
  description: string;
  columnId: string;
  assignee: BoardActor | null;
  dueAt: string;
  labels: string[];
  thread: BoardThreadLink | null;
}

function draftOf(card: BoardCard): Draft {
  return {
    title: card.title,
    description: card.description,
    columnId: card.columnId,
    assignee: card.assignee,
    dueAt: card.dueAt ?? "",
    labels: [...card.labels],
    thread: card.thread,
  };
}

function sameActor(left: BoardActor | null, right: BoardActor | null): boolean {
  return actorKey(left) === actorKey(right);
}

function sameThread(left: BoardThreadLink | null, right: BoardThreadLink | null): boolean {
  return left?.agentId === right?.agentId && left?.threadId === right?.threadId;
}

function patchOf(card: BoardCard, draft: Draft): BoardCardPatch {
  const patch: BoardCardPatch = {};
  if (draft.title.trim() !== card.title) patch.title = draft.title.trim();
  if (draft.description !== card.description) patch.description = draft.description;
  if (!sameActor(draft.assignee, card.assignee)) patch.assignee = draft.assignee;
  if (draft.dueAt !== (card.dueAt ?? "")) patch.dueAt = draft.dueAt === "" ? null : draft.dueAt;
  if (draft.labels.join("\n") !== card.labels.join("\n")) patch.labels = draft.labels;
  if (!sameThread(draft.thread, card.thread)) patch.thread = draft.thread;
  return patch;
}

function Section(props: { label: string; children: (labelId: string) => JSX.Element }) {
  const labelId = createUniqueId();
  return (
    <div class="ui-field">
      <span class="ui-label" id={labelId}>
        {props.label}
      </span>
      {props.children(labelId)}
    </div>
  );
}

export function BoardCardDialog(props: { board: BoardSummary; card: BoardCard; onClose: () => void }) {
  const { t } = useText();
  const boards = useBoards();
  const view = boards.view;
  const card = props.card;
  const [draft, setDraft] = createStore<Draft>(draftOf(card));
  const [labelText, setLabelText] = createSignal("");
  const [busy, setBusy] = createSignal(false);
  const [layer, setLayer] = createSignal<HTMLElement>();
  const [confirming, setConfirming] = createSignal(false);
  const [threads, setThreads] = createSignal<BoardsThread[] | null>(null);
  const [pickedThread, setPickedThread] = createSignal<string | null>(null);
  const [pickedAgent, setPickedAgent] = createSignal<string | null>(card.thread?.agentId ?? view.agents[0]?.id ?? null);
  const release = view.hold(card.id);
  onCleanup(release);

  const present = createMemo(() => view.detail?.cards.some((candidate) => candidate.id === card.id) === true);
  createEffect(present, (here) => {
    if (!here) props.onClose();
  });

  const agentId = () => draft.thread?.agentId ?? pickedAgent();
  let threadRun = 0;
  createEffect(agentId, (id) => {
    const run = ++threadRun;
    setThreads(null);
    if (id === null) return;
    void view.threads(id).then((list) => {
      if (run === threadRun) setThreads(list);
    });
  });

  const assigneeOptions = createMemo(() => [
    NONE,
    ...view.members.map((member) => actorKey({ kind: "member", id: member.id })),
    ...view.agents.map((agent) => actorKey({ kind: "agent", id: agent.id })),
  ]);
  const assigneeOf = (key: string): BoardActor | null => (key === NONE ? null : actorOfKey(key));
  const valid = () => draft.title.trim() !== "";
  const patch = createMemo(() => patchOf(card, draft));
  const changed = () => Object.keys(patch()).length > 0 || draft.columnId !== card.columnId;
  const threadTitle = (link: BoardThreadLink) =>
    (link.agentId === agentId() ? threads()?.find((thread) => thread.id === link.threadId)?.title : undefined) ??
    link.threadId;
  const agentName = (id: string) => boards.actorName({ kind: "agent", id });

  async function save() {
    if (!valid() || busy()) return;
    setBusy(true);
    try {
      const fields = patch();
      if (Object.keys(fields).length > 0) {
        const result = await view.apply({ kind: "card-update", cardId: card.id, patch: fields });
        if (result === null) return;
      }
      if (draft.columnId !== card.columnId) {
        if (!(await view.moveCard(card.id, { columnId: draft.columnId, beforeCardId: null }))) return;
      }
      props.onClose();
    } finally {
      setBusy(false);
    }
  }

  async function archive() {
    setBusy(true);
    try {
      const result = await view.apply({ kind: "card-archive", cardId: card.id, archived: true });
      if (result !== null) props.onClose();
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    const result = await view.apply({ kind: "card-delete", cardId: card.id });
    setConfirming(false);
    if (result !== null) props.onClose();
  }

  function addLabel() {
    const next = parseLabels(draft.labels, labelText());
    setLabelText("");
    setDraft((state) => {
      state.labels = next;
    });
  }

  return (
    <Dialog.Root open onOpenChange={(open: boolean) => !open && props.onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay class="ui-confirm-dialog-overlay">
          <Dialog.Content as="section" class="ui-confirm-dialog boards-card-dialog" ref={setLayer}>
            <BoardsPopupLayer value={layer}>
              <form
                class="boards-form"
                onSubmit={(event) => {
                  event.preventDefault();
                  void save();
                }}
              >
                <Dialog.Title class="boards-form-title">{t("boards.dialog.title")}</Dialog.Title>
                <div class="boards-form-grid">
                  <Field label={t("boards.dialog.titleField")} class="boards-wide" required>
                    <Input
                      value={draft.title}
                      maxlength={BOARD_LIMITS.cardTitle}
                      onValueChange={(value) =>
                        setDraft((state) => {
                          state.title = value;
                        })
                      }
                    />
                  </Field>
                  <Field label={t("boards.dialog.description")} class="boards-wide">
                    <Textarea
                      rows={5}
                      value={draft.description}
                      maxlength={BOARD_LIMITS.cardDescription}
                      onValueChange={(value) =>
                        setDraft((state) => {
                          state.description = value;
                        })
                      }
                    />
                  </Field>
                  <Section label={t("boards.dialog.column")}>
                    {(labelId) => (
                      <ChoiceSelect
                        options={props.board.columns.map((column) => column.id)}
                        value={draft.columnId}
                        text={(id) => props.board.columns.find((column) => column.id === id)?.name ?? id}
                        labelledBy={labelId}
                        onChange={(id) =>
                          setDraft((state) => {
                            state.columnId = id;
                          })
                        }
                      />
                    )}
                  </Section>
                  <Section label={t("boards.dialog.assignee")}>
                    {(labelId) => (
                      <ChoiceSelect
                        options={assigneeOptions()}
                        value={actorKey(draft.assignee)}
                        text={(key) => {
                          const actor = assigneeOf(key);
                          return (
                            <span class="boards-person">
                              <Avatar name={boards.actorName(actor)} kind={actor?.kind ?? "none"} />
                              {actor === null ? t("boards.dialog.nobody") : boards.actorName(actor)}
                            </span>
                          );
                        }}
                        labelledBy={labelId}
                        onChange={(key) =>
                          setDraft((state) => {
                            state.assignee = assigneeOf(key);
                          })
                        }
                      />
                    )}
                  </Section>
                  <Field label={t("boards.dialog.due")}>
                    <Input
                      type="date"
                      value={draft.dueAt}
                      onValueChange={(value) =>
                        setDraft((state) => {
                          state.dueAt = value;
                        })
                      }
                    />
                  </Field>
                  <Section label={t("boards.dialog.labels")}>
                    {(labelId) => (
                      <div class="boards-labels-edit">
                        <ul class="boards-labels" aria-labelledby={labelId}>
                          <For each={draft.labels}>
                            {(label) => (
                              <li class="boards-label">
                                <span>{label}</span>
                                <IconButton
                                  type="button"
                                  size="icon-xs"
                                  label={t("boards.dialog.labelRemove", { label })}
                                  onClick={() =>
                                    setDraft((state) => {
                                      state.labels = state.labels.filter((existing) => existing !== label);
                                    })
                                  }
                                >
                                  <X aria-hidden="true" />
                                </IconButton>
                              </li>
                            )}
                          </For>
                        </ul>
                        <Show when={draft.labels.length < BOARD_LIMITS.labels}>
                          <Input
                            value={labelText()}
                            maxlength={BOARD_LIMITS.label}
                            aria-label={t("boards.dialog.labelAdd")}
                            placeholder={t("boards.dialog.labelAdd")}
                            onValueChange={setLabelText}
                            onKeyDown={(event) => {
                              if (event.key !== "Enter" && event.key !== ",") return;
                              event.preventDefault();
                              addLabel();
                            }}
                            onBlur={addLabel}
                          />
                        </Show>
                      </div>
                    )}
                  </Section>
                  <Section label={t("boards.dialog.thread")}>
                    {(labelId) => (
                      // biome-ignore lint/a11y/useSemanticElements: labelled group inside a form section
                      <div class="boards-thread" role="group" aria-labelledby={labelId}>
                        <Show
                          when={draft.thread}
                          fallback={
                            <Show
                              when={view.agents.length > 0}
                              fallback={<p class="boards-hint">{t("boards.dialog.threadNone")}</p>}
                            >
                              <ThreadPicker
                                agents={view.agents.map((agent) => agent.id)}
                                agentId={pickedAgent()}
                                onAgent={(id) => {
                                  setPickedAgent(id);
                                  setPickedThread(null);
                                }}
                                threads={threads()}
                                threadId={pickedThread()}
                                onThread={setPickedThread}
                                onLink={(thread) => {
                                  const id = pickedAgent();
                                  if (id === null) return;
                                  setDraft((state) => {
                                    state.thread = { agentId: id, threadId: thread };
                                  });
                                  setPickedThread(null);
                                }}
                              />
                            </Show>
                          }
                        >
                          {(link) => (
                            <div class="boards-thread-linked">
                              <span class="boards-thread-name">
                                <MessageSquare aria-hidden="true" />
                                <span>{agentName(link().agentId)}</span>
                                <span class="boards-thread-title">{threadTitle(link())}</span>
                              </span>
                              <Button type="button" size="sm" variant="ghost" onClick={() => view.openThread(link())}>
                                {t("boards.dialog.threadOpen")}
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                onClick={() =>
                                  setDraft((state) => {
                                    state.thread = null;
                                  })
                                }
                              >
                                <Link2Off aria-hidden="true" />
                                {t("boards.dialog.threadUnlink")}
                              </Button>
                            </div>
                          )}
                        </Show>
                      </div>
                    )}
                  </Section>
                </div>
                <p class="boards-hint">
                  {t("boards.dialog.meta", {
                    creator: boards.actorName(card.createdBy),
                    editor: boards.actorName(card.updatedBy),
                  })}
                </p>
                <div class="boards-form-actions">
                  <Button type="button" variant="ghost" disabled={busy()} onClick={() => void archive()}>
                    <Archive aria-hidden="true" />
                    {t("boards.dialog.archive")}
                  </Button>
                  <Button type="button" variant="ghost" disabled={busy()} onClick={() => setConfirming(true)}>
                    <Trash2 aria-hidden="true" />
                    {t("boards.dialog.delete")}
                  </Button>
                  <span class="boards-spacer" />
                  <Button type="button" variant="ghost" onClick={() => props.onClose()}>
                    {t("common.cancel")}
                  </Button>
                  <Button type="submit" disabled={!valid() || busy() || !changed()}>
                    {t("boards.dialog.save")}
                  </Button>
                </div>
              </form>
              <ConfirmDialog
                open={confirming()}
                tone="destructive"
                title={t("boards.dialog.deleteTitle")}
                description={t("boards.dialog.deleteBody")}
                confirmLabel={t("boards.dialog.delete")}
                onCancel={() => setConfirming(false)}
                onConfirm={remove}
              />
            </BoardsPopupLayer>
          </Dialog.Content>
        </Dialog.Overlay>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function ThreadPicker(props: {
  agents: string[];
  agentId: string | null;
  onAgent: (id: string) => void;
  threads: BoardsThread[] | null;
  threadId: string | null;
  onThread: (id: string) => void;
  onLink: (threadId: string) => void;
}) {
  const { t } = useText();
  const boards = useBoards();
  const agentLabel = createUniqueId();
  const threadLabel = createUniqueId();
  const agentText = (id: string) => boards.actorName({ kind: "agent", id });
  return (
    <div class="boards-thread-picker">
      <span class="ui-label" id={agentLabel}>
        {t("boards.dialog.threadAgent")}
      </span>
      <Show when={props.agentId}>
        {(id) => (
          <ChoiceSelect
            options={props.agents}
            value={id()}
            text={agentText}
            labelledBy={agentLabel}
            onChange={props.onAgent}
          />
        )}
      </Show>
      <span class="ui-label" id={threadLabel}>
        {t("boards.dialog.threadPick")}
      </span>
      <Show
        when={props.threads}
        fallback={
          <p class="boards-hint" role="status">
            {t("boards.dialog.threadLoading")}
          </p>
        }
      >
        {(list) => (
          <Show
            when={list().length > 0}
            fallback={
              <p class="boards-hint" role="status">
                {t("boards.dialog.threadEmpty")}
              </p>
            }
          >
            <ChoiceSelect
              options={list().map((thread) => thread.id)}
              value={props.threadId ?? list()[0]?.id ?? ""}
              text={(id) => list().find((thread) => thread.id === id)?.title ?? id}
              labelledBy={threadLabel}
              onChange={props.onThread}
            />
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={() => {
                const id = props.threadId ?? list()[0]?.id;
                if (id !== undefined) props.onLink(id);
              }}
            >
              <Link2 aria-hidden="true" />
              {t("boards.dialog.threadLink")}
            </Button>
          </Show>
        )}
      </Show>
    </div>
  );
}
