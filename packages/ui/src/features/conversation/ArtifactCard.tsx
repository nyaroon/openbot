import { Button, FileText } from "@openbot/ui";
import { useText } from "../../text";
import { UiBlockCard } from "./ui-blocks/UiBlockCard";

export interface ArtifactCardProps {
  title: string;
  version: number;
  onOpen: () => void;
}

/** A page that an agent published. Open shows it in the browser. */
export function ArtifactCard(props: ArtifactCardProps) {
  const { t } = useText();
  return (
    <UiBlockCard
      class="marketplace-suggestion setting-link-card"
      status="pending"
      inlineActions
      icon={
        <span class="ui-block-icon setting-link-icon">
          <FileText aria-hidden="true" />
        </span>
      }
      title={props.title}
      subtitle={t("chat.artifactCard.subtitle", { version: props.version })}
      actions={
        <Button type="button" size="sm" onClick={() => props.onOpen()}>
          {t("chat.actionCard.open")}
        </Button>
      }
    />
  );
}
