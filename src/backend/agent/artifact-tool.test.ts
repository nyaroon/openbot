import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Effect } from "effect";
import { describe, expect, it } from "vitest";
import {
  ARTIFACT_HTML_LIMIT,
  type ArtifactOperations,
  ArtifactRefusal,
  type ArtifactSummary,
  handleArtifactTool,
} from "./artifact-tool";

const ID = "abcdefghijklmnopqrstuv";

const summary: ArtifactSummary = {
  id: ID,
  url: `https://example.test/a/${ID}`,
  title: "Plan",
  version: 2,
  visibility: "organization",
  organizationName: "Team",
  ownerName: "Rina",
  updatedAt: Date.UTC(2026, 10, 27),
};

function operations(published: Array<Parameters<ArtifactOperations["publish"]>[0]> = []): ArtifactOperations {
  return {
    publish: (input) => {
      published.push(input);
      return Effect.succeed(summary);
    },
    list: () => Effect.succeed([summary]),
    read: () =>
      Effect.succeed({
        artifact: summary,
        html: "<p>page</p>",
        versions: [{ version: 2, bytes: 11, createdAt: summary.updatedAt }],
        comments: [{ author: "Budi", body: "Add totals", createdAt: summary.updatedAt }],
      }),
    remove: () => Effect.fail(new ArtifactRefusal("You do not have permission to do this.")),
  };
}

function answer(response: { contentItems: Array<{ text: string }> } | null) {
  return JSON.parse(response?.contentItems[0]?.text ?? "null");
}

describe("artifact tools", () => {
  it("leaves other tools alone", async () => {
    expect(await Effect.runPromise(handleArtifactTool("list_boards", {}, operations()))).toBeNull();
  });

  it("says that artifacts are unavailable without the account service", async () => {
    const response = await Effect.runPromise(handleArtifactTool("list_artifacts", {}, null));
    expect(response?.success).toBe(false);
  });

  it("publishes a page and returns its link", async () => {
    const published: Array<Parameters<ArtifactOperations["publish"]>[0]> = [];
    const response = await Effect.runPromise(
      handleArtifactTool(
        "publish_artifact",
        { title: " Plan ", html: "<p>page</p>", artifactId: ID },
        operations(published),
      ),
    );
    expect(response?.success).toBe(true);
    expect(answer(response)).toMatchObject({ artifactId: ID, url: summary.url, version: 2 });
    expect(published).toEqual([{ title: "Plan", html: "<p>page</p>", artifactId: ID }]);
  });

  it("reports a published page so that the chat can show its card", async () => {
    const shown: ArtifactSummary[] = [];
    await Effect.runPromise(
      handleArtifactTool("publish_artifact", { title: "Plan", html: "<p>page</p>" }, operations(), (artifact) =>
        shown.push(artifact),
      ),
    );
    await Effect.runPromise(handleArtifactTool("list_artifacts", {}, operations(), (artifact) => shown.push(artifact)));
    expect(shown).toEqual([summary]);
  });

  it("reads the page from a file", async () => {
    const folder = await mkdtemp(join(tmpdir(), "artifact-tool-"));
    try {
      const file = join(folder, "page.html");
      await writeFile(file, "<h1>From a file</h1>");
      const published: Array<Parameters<ArtifactOperations["publish"]>[0]> = [];
      const response = await Effect.runPromise(
        handleArtifactTool("publish_artifact", { title: "Plan", file }, operations(published)),
      );
      expect(response?.success).toBe(true);
      expect(published[0]?.html).toBe("<h1>From a file</h1>");
    } finally {
      await rm(folder, { recursive: true, force: true });
    }
  });

  it("refuses a page with both or neither of html and file, and a page that is too large", async () => {
    const both = await Effect.runPromise(
      handleArtifactTool("publish_artifact", { title: "Plan", html: "<p></p>", file: "C:\\page.html" }, operations()),
    );
    const neither = await Effect.runPromise(handleArtifactTool("publish_artifact", { title: "Plan" }, operations()));
    const large = await Effect.runPromise(
      handleArtifactTool(
        "publish_artifact",
        { title: "Plan", html: "é".repeat(ARTIFACT_HTML_LIMIT - 1) },
        operations(),
      ),
    );
    expect([both?.success, neither?.success, large?.success]).toEqual([false, false, false]);
  });

  it("returns comments, and the HTML only when asked", async () => {
    const plain = answer(await Effect.runPromise(handleArtifactTool("get_artifact", { artifactId: ID }, operations())));
    expect(plain.comments).toEqual([{ author: "Budi", body: "Add totals", createdAt: "2026-11-27T00:00:00.000Z" }]);
    expect(plain.html).toBeUndefined();
    const full = answer(
      await Effect.runPromise(handleArtifactTool("get_artifact", { artifactId: ID, includeHtml: true }, operations())),
    );
    expect(full.html).toBe("<p>page</p>");
  });

  it("turns a refusal of the account service into a tool failure", async () => {
    const response = await Effect.runPromise(handleArtifactTool("delete_artifact", { artifactId: ID }, operations()));
    expect(response?.success).toBe(false);
    expect(answer(response).error).toBe("You do not have permission to do this.");
  });
});
