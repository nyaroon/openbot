import type { DatabaseSync, SQLInputValue } from "node:sqlite";
import { Effect } from "effect";
import { afterEach, describe, expect, it } from "vitest";
import { ARTIFACT_FRAME_SANDBOX, artifactNoticePage, artifactPage } from "../src/server/artifact-pages";
import {
  ARTIFACT_VERSION_LIMIT,
  type ArtifactActor,
  ArtifactError,
  type ArtifactPage,
  Artifacts,
  isArtifactId,
  readArtifactPublishInput,
} from "../src/server/artifacts";
import type { ObjectBucket } from "../src/server/object-storage";
import { migratedDatabase } from "./sqlite-d1";

const databases: DatabaseSync[] = [];

afterEach(() => {
  for (const database of databases.splice(0)) database.close();
});

/** The few D1 calls that the artifact store makes, over an in-memory SQLite database. */
function d1(database: DatabaseSync): D1Database {
  const statement = (sql: string, values: SQLInputValue[] = []) => ({
    bind: (...next: SQLInputValue[]) => statement(sql, next),
    first: async () => database.prepare(sql).get(...values) ?? null,
    all: async () => ({ results: database.prepare(sql).all(...values) }),
    run: async () => {
      database.prepare(sql).run(...values);
      return {};
    },
  });
  return {
    prepare: (sql: string) => statement(sql),
    batch: async (statements: Array<{ run: () => Promise<unknown> }>) => {
      for (const item of statements) await item.run();
      return [];
    },
    // biome-ignore lint/nursery/noUnsafeTypeAssertion: a test double that has only the calls the store makes.
  } as unknown as D1Database;
}

function memoryBucket(objects: Map<string, string>): ObjectBucket {
  return {
    get: async (key: string) => {
      const text = objects.get(key);
      // biome-ignore lint/nursery/noUnsafeTypeAssertion: a test double that has only the calls the store makes.
      return text === undefined ? null : ({ text: async () => text } as never);
    },
    head: async () => null,
    put: async (key: string, value: unknown) => {
      objects.set(key, value instanceof Uint8Array ? new TextDecoder().decode(value) : String(value));
    },
    delete: async (keys: string | string[]) => {
      for (const key of [keys].flat()) objects.delete(key);
    },
    // biome-ignore lint/nursery/noUnsafeTypeAssertion: a test double that has only the calls the store makes.
    list: async () => ({ objects: [], truncated: false }) as never,
    // biome-ignore lint/nursery/noUnsafeTypeAssertion: a test double that has only the calls the store makes.
  } as ObjectBucket;
}

const owner: ArtifactActor = { id: "user-owner", email: "owner@example.com" };
const member: ArtifactActor = { id: "user-member", email: "member@example.com" };
const outsider: ArtifactActor = { id: "user-outsider", email: "outsider@example.com" };

function setup() {
  const database = migratedDatabase();
  databases.push(database);
  for (const actor of [owner, member, outsider]) {
    database
      .prepare("INSERT INTO users(id, identity_key, email, name, created_at, updated_at) VALUES (?, ?, ?, NULL, 1, 1)")
      .run(actor.id, actor.id, actor.email);
  }
  database.exec(`
    INSERT INTO organizations(id, name, created_by, created_at, updated_at)
      VALUES ('org-a', 'Team A', 'user-owner', 1, 1), ('org-b', 'Team B', 'user-outsider', 1, 1);
    INSERT INTO organization_members(organization_id, user_id, role, created_at)
      VALUES ('org-a', 'user-owner', 'owner', 1), ('org-a', 'user-member', 'member', 1),
             ('org-b', 'user-outsider', 'owner', 1);
  `);
  const objects = new Map<string, string>();
  let now = 1_000;
  const artifacts = new Artifacts({
    database: d1(database),
    bucket: () => memoryBucket(objects),
    ownerEmails: new Set(),
    now: () => now++,
  });
  return { artifacts, objects, database };
}

async function refusal<T>(effect: Effect.Effect<T, unknown>): Promise<ArtifactError> {
  const error = await Effect.runPromise(Effect.flip(effect));
  if (!(error instanceof ArtifactError)) throw new Error("Expected an artifact refusal.");
  return error;
}

describe("artifacts", () => {
  it("publishes a page for the only organization of the account and keeps the link on update", async () => {
    const { artifacts, objects } = setup();
    const first = await Effect.runPromise(artifacts.publish(member, { title: "Plan", html: "<p>one</p>" }));
    expect(isArtifactId(first.id)).toBe(true);
    expect(first).toMatchObject({ version: 1, organizationId: "org-a", visibility: "organization" });
    const second = await Effect.runPromise(
      artifacts.publish(member, { title: "Plan v2", html: "<p>two</p>", artifactId: first.id }),
    );
    expect(second).toMatchObject({ id: first.id, version: 2, title: "Plan v2" });
    expect(objects.get(`artifacts/${first.id}/1.html`)).toBe("<p>one</p>");
    const page = await Effect.runPromise(artifacts.read(owner, first.id));
    expect(page).toMatchObject({ html: "<p>two</p>", shownVersion: 2, member: true, canManage: true });
    expect(page.versions.map((item) => item.version)).toEqual([2, 1]);
    const old = await Effect.runPromise(artifacts.read(owner, first.id, 1));
    expect(old.html).toBe("<p>one</p>");
  });

  it("hides an organization artifact from other accounts and from visitors", async () => {
    const { artifacts } = setup();
    const artifact = await Effect.runPromise(artifacts.publish(owner, { title: "Plan", html: "<p>secret</p>" }));
    for (const reader of [outsider, null]) {
      const error = await refusal(artifacts.read(reader, artifact.id));
      expect(error.status).toBe(404);
    }
    expect(await Effect.runPromise(artifacts.list(outsider))).toEqual([]);
    expect((await refusal(artifacts.comment(outsider, artifact.id, "hi"))).status).toBe(404);
    expect((await refusal(artifacts.remove(outsider, artifact.id))).status).toBe(404);
    const taken = await refusal(
      artifacts.publish(outsider, { title: "Taken", html: "<p></p>", artifactId: artifact.id }),
    );
    expect(taken.status).toBe(404);
  });

  it("lets only the publisher and the managers change or delete an artifact", async () => {
    const { artifacts, objects } = setup();
    const artifact = await Effect.runPromise(artifacts.publish(owner, { title: "Plan", html: "<p>one</p>" }));
    expect((await refusal(artifacts.remove(member, artifact.id))).status).toBe(403);
    expect((await refusal(artifacts.setVisibility(member, artifact.id, "public"))).status).toBe(403);
    await Effect.runPromise(artifacts.remove(owner, artifact.id));
    expect(objects.size).toBe(0);
    expect((await refusal(artifacts.read(owner, artifact.id))).status).toBe(404);
  });

  it("shows a public artifact to a visitor without its history or comments", async () => {
    const { artifacts } = setup();
    const artifact = await Effect.runPromise(artifacts.publish(owner, { title: "Plan", html: "<p>one</p>" }));
    await Effect.runPromise(artifacts.publish(owner, { title: "Plan", html: "<p>two</p>", artifactId: artifact.id }));
    await Effect.runPromise(artifacts.comment(member, artifact.id, " Add totals "));
    await Effect.runPromise(artifacts.setVisibility(owner, artifact.id, "public"));
    const visitor = await Effect.runPromise(artifacts.read(null, artifact.id, 1));
    expect(visitor).toMatchObject({ html: "<p>two</p>", member: false, canManage: false, versions: [], comments: [] });
    const reader = await Effect.runPromise(artifacts.read(member, artifact.id));
    expect(reader.comments.map((item) => item.body)).toEqual(["Add totals"]);
    expect(reader.canManage).toBe(false);
  });

  it("asks for the organization when the account is in several, and refuses one it is not in", async () => {
    const { artifacts, database } = setup();
    database.exec(
      "INSERT INTO organization_members(organization_id, user_id, role, created_at) VALUES ('org-b', 'user-member', 'member', 1)",
    );
    const error = await refusal(artifacts.publish(member, { title: "Plan", html: "<p></p>" }));
    expect(error.code).toBe("organization_required");
    expect(error.message).toContain("org-b");
    const chosen = await Effect.runPromise(
      artifacts.publish(member, { title: "Plan", html: "<p></p>", organizationId: "org-b" }),
    );
    expect(chosen.organizationId).toBe("org-b");
    const foreign = await refusal(
      artifacts.publish(owner, { title: "Plan", html: "<p></p>", organizationId: "org-b" }),
    );
    expect(foreign.status).toBe(404);
  });

  it("keeps the last versions only and refuses a page that is too large", async () => {
    const { artifacts, objects } = setup();
    const artifact = await Effect.runPromise(artifacts.publish(owner, { title: "Plan", html: "<p>1</p>" }));
    for (let version = 2; version <= ARTIFACT_VERSION_LIMIT + 2; version += 1) {
      await Effect.runPromise(
        artifacts.publish(owner, { title: "Plan", html: `<p>${version}</p>`, artifactId: artifact.id }),
      );
    }
    expect(objects.size).toBe(ARTIFACT_VERSION_LIMIT);
    expect(objects.has(`artifacts/${artifact.id}/2.html`)).toBe(false);
    const large = await refusal(artifacts.publish(owner, { title: "Plan", html: "x".repeat(512_001) }));
    expect(large.status).toBe(413);
  });
});

function shownPage(overrides: Partial<ArtifactPage> = {}): ArtifactPage {
  return {
    artifact: {
      id: "abcdefghijklmnopqrstuv",
      title: 'Plan <script>alert("title")</script>',
      version: 2,
      visibility: "organization",
      organizationId: "org-a",
      organizationName: "Team A",
      ownerName: "Rina",
      createdAt: 1,
      updatedAt: 2,
    },
    shownVersion: 2,
    html: '<script>parent.document.title = "x"</script><p class="a">it\'s &amp; done</p>',
    versions: [
      { version: 2, bytes: 2048, createdAt: 2 },
      { version: 1, bytes: 100, createdAt: 1 },
    ],
    comments: [{ id: "c1", author: "Budi", body: "<b>bold</b>", createdAt: 2 }],
    member: true,
    canManage: true,
    ...overrides,
  };
}

describe("artifact page", () => {
  it("keeps the published HTML inside the sandboxed frame", async () => {
    const response = artifactPage(shownPage());
    const html = await response.text();
    expect(html).toContain(`sandbox="${ARTIFACT_FRAME_SANDBOX}"`);
    expect(ARTIFACT_FRAME_SANDBOX).not.toContain("allow-same-origin");
    expect(ARTIFACT_FRAME_SANDBOX).not.toContain("allow-top-navigation");
    // Nothing from the artifact, its title or a comment reaches the page as markup.
    expect(html).not.toContain("<script>");
    expect(html).not.toContain("<b>bold</b>");
    expect(html).toContain("&lt;script&gt;parent.document.title = &quot;x&quot;&lt;/script&gt;");
    expect(html).toContain("it&#39;s &amp;amp; done");
    expect(response.headers.get("X-Frame-Options")).toBe("DENY");
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
  });

  it("shows the controls only to a person who may use them", async () => {
    const manager = await artifactPage(shownPage()).text();
    expect(manager).toContain("Make the link public");
    expect(manager).toContain("Delete artifact");
    const reader = await artifactPage(shownPage({ canManage: false })).text();
    expect(reader).toContain("Add comment");
    expect(reader).not.toContain("Delete artifact");
    const visitor = await artifactPage(
      shownPage({ member: false, canManage: false, versions: [], comments: [] }),
    ).text();
    expect(visitor).not.toContain("<form");
  });

  it("answers a missing artifact with its status", () => {
    expect(artifactNoticePage({ status: 404, title: "Artifact not found", text: "Gone." }).status).toBe(404);
  });
});

describe("artifact input", () => {
  it("accepts a page and trims its title", () => {
    expect(readArtifactPublishInput({ title: " Plan ", html: "<p></p>" })).toEqual({ title: "Plan", html: "<p></p>" });
  });

  it("refuses an empty page, a long title and a wrong id", () => {
    expect(readArtifactPublishInput({ title: "Plan", html: "  " })).toBeNull();
    expect(readArtifactPublishInput({ title: "x".repeat(201), html: "<p></p>" })).toBeNull();
    expect(readArtifactPublishInput({ title: "Plan", html: "<p></p>", artifactId: "../1" })).toBeNull();
  });
});
