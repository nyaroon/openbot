import { describe, expect, it } from "vitest";
import { artifactEvent, artifactEventText, artifactItemType } from "./artifact-events";
import type { ConversationMessage } from "./ipc-conversation-messages";

const ID = "abcdefghijklmnopqrstuv";
const URL = `https://example.test/a/${ID}`;

function card(overrides: Partial<ConversationMessage> = {}): ConversationMessage {
  return {
    id: "message-1",
    author: "system",
    source: "system",
    status: "completed",
    createdAt: "2026-11-27T00:00:00.000Z",
    itemType: artifactItemType({ artifactId: ID, version: 3 }),
    text: artifactEventText({ title: "Sales\nreport", url: URL }),
    ...overrides,
  };
}

describe("artifact chat cards", () => {
  it("reads the artifact back from the message", () => {
    expect(artifactEvent(card())).toEqual({ artifactId: ID, version: 3, title: "Sales report", url: URL });
  });

  it("refuses an invalid artifact id", () => {
    expect(() => artifactItemType({ artifactId: "short", version: 1 })).toThrow();
  });

  it("ignores messages that are not a card of the app", () => {
    expect(artifactEvent(card({ author: "assistant" }))).toBeNull();
    expect(artifactEvent(card({ itemType: `artifact:${ID}:0` }))).toBeNull();
    expect(artifactEvent(card({ itemType: "artifact:short:1" }))).toBeNull();
    expect(artifactEvent(card({ text: "Sales report" }))).toBeNull();
    expect(artifactEvent(card({ text: "Sales report\njavascript:alert(1)" }))).toBeNull();
  });
});
