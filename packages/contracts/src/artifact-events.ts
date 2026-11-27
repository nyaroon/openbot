import type { ConversationMessage } from "./ipc-conversation-messages";

export const ARTIFACT_ITEM_TYPE_PREFIX = "artifact:";

const ARTIFACT_ID = /^[A-Za-z0-9_-]{22}$/u;

/** An artifact that an agent published in a chat. The chat shows it as a card. */
export interface ArtifactEvent {
  artifactId: string;
  version: number;
  title: string;
  url: string;
}

export function artifactItemType(event: Pick<ArtifactEvent, "artifactId" | "version">): string {
  if (!ARTIFACT_ID.test(event.artifactId)) throw new Error("A valid artifact id is required.");
  return `${ARTIFACT_ITEM_TYPE_PREFIX}${event.artifactId}:${event.version}`;
}

/** The message text: the title, then the link on its own line. A client without the card shows this text. */
export function artifactEventText(event: Pick<ArtifactEvent, "title" | "url">): string {
  return `${event.title.replaceAll(/\s+/gu, " ").trim()}\n${event.url}`;
}

export function artifactEvent(message: ConversationMessage): ArtifactEvent | null {
  if (message.author !== "system" || message.source !== "system" || message.status !== "completed") return null;
  if (!message.itemType?.startsWith(ARTIFACT_ITEM_TYPE_PREFIX)) return null;
  const [artifactId = "", versionText = ""] = message.itemType.slice(ARTIFACT_ITEM_TYPE_PREFIX.length).split(":");
  const version = Number(versionText);
  if (!ARTIFACT_ID.test(artifactId) || !Number.isInteger(version) || version < 1) return null;
  const lineBreak = message.text.lastIndexOf("\n");
  if (lineBreak < 1) return null;
  const url = message.text.slice(lineBreak + 1).trim();
  if (!/^https:\/\/[^\s]+$/u.test(url)) return null;
  return { artifactId, version, title: message.text.slice(0, lineBreak).trim(), url };
}
