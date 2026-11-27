import { readFile, stat } from "node:fs/promises";
import { isAbsolute } from "node:path";
import { Effect } from "effect";
import { z } from "zod";
import { openBotToolFailure, openBotToolResult } from "./routine-tools";
import { toolStep } from "./tool-operation";

export const ARTIFACT_HTML_LIMIT = 512_000;
const TITLE_LIMIT = 200;

const artifactId = z.string().regex(/^[A-Za-z0-9_-]{22}$/u, "Use the id that publish_artifact or list_artifacts gave.");

const publishSchema = z.strictObject({
  title: z.string().trim().min(1).max(TITLE_LIMIT),
  html: z.string().min(1).max(ARTIFACT_HTML_LIMIT).optional().describe("the complete page; or pass file"),
  file: z.string().min(1).max(4_096).optional().describe("absolute path of an .html file; or pass html"),
  artifactId: artifactId.optional().describe("update this artifact in place; its link stays the same"),
  organizationId: z.string().min(1).max(100).optional().describe("only when the account is in several organizations"),
});
const listSchema = z.strictObject({});
const getSchema = z.strictObject({
  artifactId,
  includeHtml: z.boolean().optional().describe("also return the HTML of the latest version"),
});
const deleteSchema = z.strictObject({ artifactId });

export const ARTIFACT_TOOL_DEFINITIONS = [
  {
    name: "publish_artifact",
    description:
      "Publish a self-contained HTML page as an artifact: a page with its own link that members of the user's organization open in a browser. Returns the link. Pass artifactId to publish a new version at the same link.",
    shape: publishSchema.shape,
  },
  {
    name: "list_artifacts",
    description: "List the artifacts of the user's organizations with their links, versions and who sees them.",
    shape: listSchema.shape,
  },
  {
    name: "get_artifact",
    description:
      "Read one artifact: its link, versions and the comments that members left on it. Set includeHtml to get its HTML.",
    shape: getSchema.shape,
  },
  {
    name: "delete_artifact",
    description: "Delete an artifact with every version. Its link stops working. Only when the user asks for it.",
    shape: deleteSchema.shape,
  },
] as const;

export const ARTIFACT_TOOL_NAMES: ReadonlySet<string> = new Set(ARTIFACT_TOOL_DEFINITIONS.map((tool) => tool.name));

export interface ArtifactSummary {
  id: string;
  url: string;
  title: string;
  version: number;
  visibility: "organization" | "public";
  organizationName: string;
  ownerName: string;
  updatedAt: number;
}

export interface ArtifactDetail {
  artifact: ArtifactSummary;
  html: string;
  versions: Array<{ version: number; bytes: number; createdAt: number }>;
  comments: Array<{ author: string; body: string; createdAt: number }>;
}

/** A refusal that the agent can read and act on, such as "sign in first". */
export class ArtifactRefusal extends Error {}

export interface ArtifactOperations {
  publish(input: {
    title: string;
    html: string;
    artifactId?: string;
    organizationId?: string;
  }): Effect.Effect<ArtifactSummary, ArtifactRefusal>;
  list(): Effect.Effect<ArtifactSummary[], ArtifactRefusal>;
  read(artifactId: string): Effect.Effect<ArtifactDetail, ArtifactRefusal>;
  remove(artifactId: string): Effect.Effect<void, ArtifactRefusal>;
}

function day(time: number): string {
  return new Date(time).toISOString();
}

function compact(artifact: ArtifactSummary) {
  return {
    artifactId: artifact.id,
    url: artifact.url,
    title: artifact.title,
    version: artifact.version,
    visibility: artifact.visibility,
    organization: artifact.organizationName,
    owner: artifact.ownerName,
    updatedAt: day(artifact.updatedAt),
  };
}

const readPage = Effect.fn("ArtifactTools.readPage")(function* (file: string) {
  if (!isAbsolute(file)) return yield* Effect.fail(new ArtifactRefusal("Pass the absolute path of the file."));
  return yield* Effect.tryPromise({
    try: async () => {
      const info = await stat(file);
      if (!info.isFile()) throw new ArtifactRefusal("The path is not a file.");
      if (info.size > ARTIFACT_HTML_LIMIT) throw new ArtifactRefusal("The page is larger than 512 KB.");
      return await readFile(file, "utf8");
    },
    catch: (error) => (error instanceof ArtifactRefusal ? error : new ArtifactRefusal("The file cannot be read.")),
  });
});

export const handleArtifactTool = Effect.fn("ArtifactTools.handle")(function* (
  tool: string,
  args: unknown,
  artifacts: ArtifactOperations | null,
) {
  if (!ARTIFACT_TOOL_NAMES.has(tool)) return null;
  if (!artifacts) return openBotToolFailure("Artifacts are unavailable on this computer.");

  const operation = Effect.gen(function* () {
    if (tool === "publish_artifact") {
      const input = yield* toolStep(() => publishSchema.parse(args));
      if ((input.html === undefined) === (input.file === undefined)) {
        return openBotToolFailure("Pass exactly one of html and file.");
      }
      const html = input.html ?? (yield* readPage(input.file ?? ""));
      if (html.trim().length === 0) return openBotToolFailure("The page is empty.");
      if (Buffer.byteLength(html, "utf8") > ARTIFACT_HTML_LIMIT) {
        return openBotToolFailure("The page is larger than 512 KB.");
      }
      const artifact = yield* artifacts.publish({
        title: input.title,
        html,
        ...(input.artifactId === undefined ? {} : { artifactId: input.artifactId }),
        ...(input.organizationId === undefined ? {} : { organizationId: input.organizationId }),
      });
      return openBotToolResult({
        ...compact(artifact),
        note: "Give the user the url. Members of the organization open it after they sign in.",
      });
    }
    if (tool === "list_artifacts") {
      yield* toolStep(() => listSchema.parse(args ?? {}));
      return openBotToolResult({ artifacts: (yield* artifacts.list()).map(compact) });
    }
    if (tool === "get_artifact") {
      const input = yield* toolStep(() => getSchema.parse(args));
      const detail = yield* artifacts.read(input.artifactId);
      return openBotToolResult({
        ...compact(detail.artifact),
        versions: detail.versions.map((item) => ({ version: item.version, createdAt: day(item.createdAt) })),
        comments: detail.comments.map((item) => ({
          author: item.author,
          body: item.body,
          createdAt: day(item.createdAt),
        })),
        ...(input.includeHtml ? { html: detail.html } : {}),
      });
    }
    const input = yield* toolStep(() => deleteSchema.parse(args));
    yield* artifacts.remove(input.artifactId);
    return openBotToolResult({ deleted: true });
  });

  return yield* operation.pipe(
    Effect.catch((error) =>
      error instanceof ArtifactRefusal ? Effect.succeed(openBotToolFailure(error.message)) : Effect.fail(error),
    ),
  );
});
