import {
  Button,
  Dialog,
  Field,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@openbot/ui";
import { useText } from "@openbot/ui/text";
import type { JSX } from "@solidjs/web";
import { createContext, createSignal, useContext } from "solid-js";
import { initialsOf } from "./boards-model";

export const BoardsPopupLayer = createContext<() => HTMLElement | undefined>(() => undefined, {
  name: "BoardsPopupLayer",
});

export function ChoiceSelect<T extends string>(props: {
  options: T[];
  value: T;
  text: (value: T) => JSX.Element;
  onChange: (value: T) => void;
  labelledBy: string;
  class?: string;
}) {
  const mount = useContext(BoardsPopupLayer);
  return (
    <Select<T>
      options={props.options}
      value={props.value}
      onChange={(next) => {
        if (next && next !== props.value) props.onChange(next);
      }}
      itemComponent={(item) => <SelectItem item={item.item}>{props.text(item.item.rawValue)}</SelectItem>}
    >
      <SelectTrigger size="sm" class={props.class ?? "boards-select"} aria-labelledby={props.labelledBy}>
        <SelectValue<T>>{() => props.text(props.value)}</SelectValue>
      </SelectTrigger>
      <SelectContent mount={mount()} />
    </Select>
  );
}

export function Avatar(props: { name: string; kind: "member" | "agent" | "none" }) {
  return (
    <span class="boards-avatar" data-kind={props.kind} aria-hidden="true">
      {props.kind === "none" ? "" : initialsOf(props.name)}
    </span>
  );
}

export function NameDialog(props: {
  title: string;
  label: string;
  initial: string;
  submit: string;
  max: number;
  onSubmit: (name: string) => Promise<boolean>;
  onClose: () => void;
}) {
  const { t } = useText();
  const [name, setName] = createSignal(props.initial);
  const [busy, setBusy] = createSignal(false);
  const valid = () => name().trim() !== "";
  const submit = async () => {
    if (!valid() || busy()) return;
    setBusy(true);
    try {
      if (await props.onSubmit(name().trim())) props.onClose();
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog.Root open onOpenChange={(open: boolean) => !open && props.onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay class="ui-confirm-dialog-overlay">
          <Dialog.Content as="section" class="ui-confirm-dialog boards-name-dialog">
            <form
              class="boards-form"
              onSubmit={(event) => {
                event.preventDefault();
                void submit();
              }}
            >
              <Dialog.Title class="boards-form-title">{props.title}</Dialog.Title>
              <Field label={props.label}>
                <Input value={name()} maxlength={props.max} autofocus onValueChange={setName} />
              </Field>
              <div class="boards-form-actions">
                <Button type="button" variant="ghost" onClick={() => props.onClose()}>
                  {t("common.cancel")}
                </Button>
                <Button type="submit" disabled={!valid() || busy()}>
                  {props.submit}
                </Button>
              </div>
            </form>
          </Dialog.Content>
        </Dialog.Overlay>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
