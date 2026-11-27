import { formatAccountIdentity } from "@openbot/contracts/phone-identity";
import { type DynamicRecord, isString } from "@openbot/contracts/runtime-values";
import { Effect } from "effect";
import { type ObjectBucket, StorageNotConfiguredError } from "./object-storage";

export const ARTIFACT_HTML_LIMIT = 512_000;
export const ARTIFACT_BODY_LIMIT = 2 * ARTIFACT_HTML_LIMIT;
export const ARTIFACT_TITLE_LIMIT = 200;
export const ARTIFACT_LIMIT = 500;
export const ARTIFACT_VERSION_LIMIT = 20;
export const ARTIFACT_COMMENT_LIMIT = 2_000;
export const ARTIFACT_COMMENTS_LIMIT = 200;

const ID = /^[A-Za-z0-9_-]{22}$/u;

export type ArtifactVisibility = "organization" | "public";

export interface ArtifactActor {
  id: string;
  email: string;
}

export class ArtifactError extends Error {
  constructor(
    readonly status: 400 | 403 | 404 | 409 | 413 | 503,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

export class ArtifactStorageError extends Error {}

export interface ArtifactView {
  id: string;
  title: string;
  version: number;
  visibility: ArtifactVisibility;
  organizationId: string;
  organizationName: string;
  ownerName: string;
  createdAt: number;
  updatedAt: number;
}

export interface ArtifactVersionView {
  version: number;
  bytes: number;
  createdAt: number;
}

export interface ArtifactCommentView {
  id: string;
  author: string;
  body: string;
  createdAt: number;
}

export interface ArtifactPage {
  artifact: ArtifactView;
  /** The version that `html` holds. It is not the latest one when an older version was asked for. */
  shownVersion: number;
  html: string;
  versions: ArtifactVersionView[];
  comments: ArtifactCommentView[];
  /** The reader belongs to the organization, so the reader may comment. */
  member: boolean;
  /** The reader may delete the artifact and change who sees it. */
  canManage: boolean;
}

export interface ArtifactPublishInput {
  title: string;
  html: string;
  artifactId?: string;
  organizationId?: string;
}

interface ArtifactRow {
  id: string;
  organization_id: string;
  owner_user_id: string;
  title: string;
  version: number;
  visibility: ArtifactVisibility;
  created_at: number;
  updated_at: number;
  organization_name: string;
  owner_name: string | null;
  owner_email: string;
  role: "owner" | "admin" | "member" | null;
}

const SELECT_ARTIFACT = `SELECT a.id, a.organization_id, a.owner_user_id, a.title, a.version, a.visibility,
         a.created_at, a.updated_at, o.name AS organization_name, u.name AS owner_name,
         u.email AS owner_email, m.role AS role
  FROM artifacts a
  JOIN organizations o ON o.id = a.organization_id
  JOIN users u ON u.id = a.owner_user_id
  LEFT JOIN organization_members m ON m.organization_id = a.organization_id AND m.user_id = ?`;

const notFound = () => new ArtifactError(404, "artifact_not_found", "Artifact not found.");
const forbidden = () => new ArtifactError(403, "forbidden", "You do not have permission to do this.");

export function isArtifactId(value: string): boolean {
  return ID.test(value);
}

export function readArtifactPublishInput(body: DynamicRecord): ArtifactPublishInput | null {
  if (!isString(body.title) || !isString(body.html)) return null;
  const title = body.title.trim();
  if (title.length === 0 || title.length > ARTIFACT_TITLE_LIMIT || body.html.trim().length === 0) return null;
  const input: ArtifactPublishInput = { title, html: body.html };
  if (body.artifactId !== undefined) {
    if (!isString(body.artifactId) || !isArtifactId(body.artifactId)) return null;
    input.artifactId = body.artifactId;
  }
  if (body.organizationId !== undefined) {
    if (!isString(body.organizationId) || body.organizationId.length > 100) return null;
    input.organizationId = body.organizationId;
  }
  return input;
}

function objectKey(artifactId: string, version: number): string {
  return `artifacts/${artifactId}/${version}.html`;
}

function newId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return btoa(String.fromCharCode(...bytes))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/u, "");
}

function person(name: string | null, email: string): string {
  return name?.trim() || formatAccountIdentity(email);
}

function viewFromRow(row: ArtifactRow): ArtifactView {
  return {
    id: row.id,
    title: row.title,
    version: row.version,
    visibility: row.visibility,
    organizationId: row.organization_id,
    organizationName: row.organization_name,
    ownerName: person(row.owner_name, row.owner_email),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Pages that agents publish for an organization. Members of the organization read them; a page
 * that a person made public is read by anyone who has its link. The object store holds the HTML.
 */
export class Artifacts {
  readonly #database: D1Database;
  readonly #bucket: () => ObjectBucket;
  readonly #ownerEmails: ReadonlySet<string>;
  readonly #now: () => number;

  constructor(options: {
    database: D1Database;
    bucket: () => ObjectBucket;
    ownerEmails: ReadonlySet<string>;
    now?: () => number;
  }) {
    this.#database = options.database;
    this.#bucket = options.bucket;
    this.#ownerEmails = options.ownerEmails;
    this.#now = options.now ?? Date.now;
  }

  #run<T>(work: () => Promise<T>): Effect.Effect<T, ArtifactError | ArtifactStorageError> {
    return Effect.tryPromise({
      try: work,
      catch: (error) => {
        if (error instanceof ArtifactError) return error;
        if (error instanceof StorageNotConfiguredError) {
          return new ArtifactError(503, "storage_not_configured", "Artifact storage is not configured.");
        }
        return new ArtifactStorageError();
      },
    });
  }

  async #row(actor: ArtifactActor | null, artifactId: string): Promise<ArtifactRow | null> {
    if (!isArtifactId(artifactId)) return null;
    return await this.#database
      .prepare(`${SELECT_ARTIFACT} WHERE a.id = ?`)
      .bind(actor?.id ?? "", artifactId)
      .first<ArtifactRow>();
  }

  #isMember(actor: ArtifactActor | null, row: ArtifactRow): boolean {
    return actor !== null && (row.role !== null || this.#ownerEmails.has(actor.email));
  }

  #canManage(actor: ArtifactActor | null, row: ArtifactRow): boolean {
    if (!actor || !this.#isMember(actor, row)) return false;
    return (
      this.#ownerEmails.has(actor.email) ||
      row.role === "owner" ||
      row.role === "admin" ||
      row.owner_user_id === actor.id
    );
  }

  /** The row when the actor may change the artifact. A reader who cannot see it gets 404. */
  async #managed(actor: ArtifactActor, artifactId: string): Promise<ArtifactRow> {
    const row = await this.#row(actor, artifactId);
    if (!row || !this.#isMember(actor, row)) throw notFound();
    if (!this.#canManage(actor, row)) throw forbidden();
    return row;
  }

  async #organizationFor(actor: ArtifactActor, organizationId: string | undefined): Promise<string> {
    const memberships = await this.#database
      .prepare(
        `SELECT o.id, o.name FROM organization_members m JOIN organizations o ON o.id = m.organization_id
         WHERE m.user_id = ? ORDER BY o.name COLLATE NOCASE, o.id`,
      )
      .bind(actor.id)
      .all<{ id: string; name: string }>();
    if (organizationId !== undefined) {
      if (memberships.results.some((item) => item.id === organizationId)) return organizationId;
      throw new ArtifactError(404, "organization_not_found", "Organization not found.");
    }
    const [only] = memberships.results;
    if (memberships.results.length === 1 && only) return only.id;
    if (memberships.results.length === 0) {
      throw new ArtifactError(403, "organization_required", "Join an organization before you publish an artifact.");
    }
    const choices = memberships.results.map((item) => `${item.name} (${item.id})`).join(", ");
    throw new ArtifactError(400, "organization_required", `Pass organizationId. Organizations: ${choices}.`);
  }

  /** Publishes a new artifact, or a new version of one when `artifactId` is given. The link stays. */
  publish(actor: ArtifactActor, input: ArtifactPublishInput) {
    return this.#run(async () => {
      const bytes = new TextEncoder().encode(input.html);
      if (bytes.byteLength > ARTIFACT_HTML_LIMIT) {
        throw new ArtifactError(413, "artifact_too_large", "The page is larger than 512 KB.");
      }
      const now = this.#now();
      const existing = input.artifactId === undefined ? null : await this.#managed(actor, input.artifactId);
      let id = existing?.id;
      let version = (existing?.version ?? 0) + 1;
      if (!existing) {
        const organizationId = await this.#organizationFor(actor, input.organizationId);
        const count = await this.#database
          .prepare("SELECT COUNT(*) AS count FROM artifacts WHERE organization_id = ?")
          .bind(organizationId)
          .first<{ count: number }>();
        if ((count?.count ?? 0) >= ARTIFACT_LIMIT) {
          throw new ArtifactError(409, "artifact_limit", "The organization has too many artifacts. Delete one first.");
        }
        id = newId();
        version = 1;
        await this.#bucket().put(objectKey(id, version), bytes, {
          httpMetadata: { contentType: "text/html; charset=utf-8" },
        });
        await this.#database.batch([
          this.#database
            .prepare(
              `INSERT INTO artifacts (id, organization_id, owner_user_id, title, version, created_at, updated_at)
               VALUES (?, ?, ?, ?, 1, ?, ?)`,
            )
            .bind(id, organizationId, actor.id, input.title, now, now),
          this.#versionInsert(id, version, bytes.byteLength, actor.id, now),
        ]);
      } else {
        await this.#bucket().put(objectKey(existing.id, version), bytes, {
          httpMetadata: { contentType: "text/html; charset=utf-8" },
        });
        await this.#database.batch([
          this.#database
            .prepare("UPDATE artifacts SET title = ?, version = ?, updated_at = ? WHERE id = ?")
            .bind(input.title, version, now, existing.id),
          this.#versionInsert(existing.id, version, bytes.byteLength, actor.id, now),
        ]);
        await this.#prune(existing.id, version);
      }
      const row = id ? await this.#row(actor, id) : null;
      if (!row) throw new ArtifactStorageError();
      return viewFromRow(row);
    });
  }

  #versionInsert(id: string, version: number, bytes: number, userId: string, now: number) {
    return this.#database
      .prepare(
        "INSERT INTO artifact_versions (artifact_id, version, bytes, created_by, created_at) VALUES (?, ?, ?, ?, ?)",
      )
      .bind(id, version, bytes, userId, now);
  }

  async #prune(artifactId: string, latest: number): Promise<void> {
    const oldest = latest - ARTIFACT_VERSION_LIMIT;
    if (oldest < 1) return;
    const old = await this.#database
      .prepare("SELECT version FROM artifact_versions WHERE artifact_id = ? AND version <= ?")
      .bind(artifactId, oldest)
      .all<{ version: number }>();
    if (old.results.length === 0) return;
    await this.#bucket().delete(old.results.map((item) => objectKey(artifactId, item.version)));
    await this.#database
      .prepare("DELETE FROM artifact_versions WHERE artifact_id = ? AND version <= ?")
      .bind(artifactId, oldest)
      .run();
  }

  /** Every artifact of the organizations that the actor belongs to, newest change first. */
  list(actor: ArtifactActor) {
    return this.#run(async () => {
      const rows = await this.#database
        .prepare(`${SELECT_ARTIFACT} WHERE m.role IS NOT NULL ORDER BY a.updated_at DESC, a.id LIMIT 1000`)
        .bind(actor.id)
        .all<ArtifactRow>();
      return rows.results.map(viewFromRow);
    });
  }

  /** The page with its history and comments. Without an actor, only a public artifact is found. */
  read(actor: ArtifactActor | null, artifactId: string, version?: number) {
    return this.#run(async () => {
      const row = await this.#row(actor, artifactId);
      const member = row !== null && this.#isMember(actor, row);
      if (!row || (!member && row.visibility !== "public")) throw notFound();
      const versions = await this.#database
        .prepare("SELECT version, bytes, created_at FROM artifact_versions WHERE artifact_id = ? ORDER BY version DESC")
        .bind(row.id)
        .all<{ version: number; bytes: number; created_at: number }>();
      // An older version is part of the history, and the history is for members.
      const shownVersion = member && version !== undefined ? version : row.version;
      if (!versions.results.some((item) => item.version === shownVersion)) throw notFound();
      const object = await this.#bucket().get(objectKey(row.id, shownVersion));
      if (!object) throw notFound();
      const comments = member
        ? await this.#database
            .prepare(
              `SELECT c.id, c.body, c.created_at, u.name, u.email
               FROM artifact_comments c JOIN users u ON u.id = c.user_id
               WHERE c.artifact_id = ? ORDER BY c.created_at, c.id`,
            )
            .bind(row.id)
            .all<{ id: string; body: string; created_at: number; name: string | null; email: string }>()
        : { results: [] };
      const page: ArtifactPage = {
        artifact: viewFromRow(row),
        shownVersion,
        html: await object.text(),
        versions: member
          ? versions.results.map((item) => ({ version: item.version, bytes: item.bytes, createdAt: item.created_at }))
          : [],
        comments: comments.results.map((item) => ({
          id: item.id,
          author: person(item.name, item.email),
          body: item.body,
          createdAt: item.created_at,
        })),
        member,
        canManage: this.#canManage(actor, row),
      };
      return page;
    });
  }

  remove(actor: ArtifactActor, artifactId: string) {
    return this.#run(async () => {
      const row = await this.#managed(actor, artifactId);
      const versions = await this.#database
        .prepare("SELECT version FROM artifact_versions WHERE artifact_id = ?")
        .bind(row.id)
        .all<{ version: number }>();
      await this.#database.prepare("DELETE FROM artifacts WHERE id = ?").bind(row.id).run();
      if (versions.results.length > 0) {
        await this.#bucket().delete(versions.results.map((item) => objectKey(row.id, item.version)));
      }
    });
  }

  /** A person decides who sees the artifact. No agent tool reaches this. */
  setVisibility(actor: ArtifactActor, artifactId: string, visibility: ArtifactVisibility) {
    return this.#run(async () => {
      const row = await this.#managed(actor, artifactId);
      await this.#database.prepare("UPDATE artifacts SET visibility = ? WHERE id = ?").bind(visibility, row.id).run();
    });
  }

  comment(actor: ArtifactActor, artifactId: string, text: string) {
    return this.#run(async () => {
      const body = text.trim();
      if (body.length === 0 || body.length > ARTIFACT_COMMENT_LIMIT) {
        throw new ArtifactError(400, "invalid_comment", "The comment is not valid.");
      }
      const row = await this.#row(actor, artifactId);
      if (!row || !this.#isMember(actor, row)) throw notFound();
      const count = await this.#database
        .prepare("SELECT COUNT(*) AS count FROM artifact_comments WHERE artifact_id = ?")
        .bind(row.id)
        .first<{ count: number }>();
      if ((count?.count ?? 0) >= ARTIFACT_COMMENTS_LIMIT) {
        throw new ArtifactError(409, "comment_limit", "The artifact has too many comments.");
      }
      await this.#database
        .prepare("INSERT INTO artifact_comments (id, artifact_id, user_id, body, created_at) VALUES (?, ?, ?, ?, ?)")
        .bind(newId(), row.id, actor.id, body, this.#now())
        .run();
    });
  }
}
