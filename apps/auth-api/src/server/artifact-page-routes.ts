import { Effect } from "effect";
import { artifactListPage, artifactNoticePage, artifactPage } from "./artifact-pages";
import { ArtifactError, type Artifacts, isArtifactId } from "./artifacts";
import type { AuthUser } from "./types";

const SIGN_IN_NOTICE = {
  status: 401,
  title: "Sign in to open this",
  text: "Sign in to Jujurly in this browser, then open the link again.",
} as const;

const NOT_FOUND_NOTICE = {
  status: 404,
  title: "Artifact not found",
  text: "The link is wrong, the artifact was deleted, or it belongs to another organization.",
} as const;

const REFUSED_NOTICE = {
  status: 403,
  title: "This did not work",
  text: "The request was refused. Open the artifact and try again.",
} as const;

/** The page for a refusal. Anything that is not an artifact refusal is left to the caller. */
export function artifactPageError(error: unknown): Response | null {
  if (!(error instanceof ArtifactError)) return null;
  if (error.status === 404) return artifactNoticePage(NOT_FOUND_NOTICE);
  return artifactNoticePage({
    status: error.status === 503 ? 503 : 403,
    title: "This did not work",
    text: error.message,
  });
}

function readVersion(request: Request): number | undefined {
  const value = new URL(request.url).searchParams.get("v");
  return value !== null && /^[1-9]\d{0,8}$/u.test(value) ? Number(value) : undefined;
}

function seeOther(request: Request, path: string): Response {
  return new Response(null, {
    status: 303,
    headers: { Location: new URL(path, request.url).toString(), "Cache-Control": "no-store" },
  });
}

export const showArtifactList = Effect.fn("ArtifactPages.list")(function* (
  artifacts: Pick<Artifacts, "list">,
  user: AuthUser | null,
) {
  if (!user) return artifactNoticePage(SIGN_IN_NOTICE);
  return artifactListPage(yield* artifacts.list(user));
});

export const showArtifact = Effect.fn("ArtifactPages.show")(function* (
  artifacts: Pick<Artifacts, "read">,
  user: AuthUser | null,
  request: Request,
  artifactId: string,
) {
  if (!isArtifactId(artifactId)) return artifactNoticePage(NOT_FOUND_NOTICE);
  const page = yield* artifacts.read(user, artifactId, readVersion(request)).pipe(
    Effect.catch((error) =>
      // A reader who is not signed in is told to sign in, not that the page is missing.
      !user && error instanceof ArtifactError && error.status === 404 ? Effect.succeed(null) : Effect.fail(error),
    ),
  );
  return page ? artifactPage(page) : artifactNoticePage(SIGN_IN_NOTICE);
});

/** The forms of the page: a comment, who sees the artifact, and its removal. Only a person sends these. */
export const changeArtifact = Effect.fn("ArtifactPages.change")(function* (
  artifacts: Pick<Artifacts, "comment" | "setVisibility" | "remove">,
  user: AuthUser | null,
  request: Request,
  artifactId: string,
) {
  if (
    request.headers.get("Origin") !== new URL(request.url).origin ||
    request.headers.get("Sec-Fetch-Site") === "cross-site" ||
    !(request.headers.get("Content-Type") ?? "").startsWith("application/x-www-form-urlencoded")
  )
    return artifactNoticePage(REFUSED_NOTICE);
  if (!user) return artifactNoticePage(SIGN_IN_NOTICE);
  const form = new URLSearchParams(yield* Effect.promise(() => request.text()));
  const action = form.get("action");
  if (action === "comment") {
    yield* artifacts.comment(user, artifactId, form.get("body") ?? "");
    return seeOther(request, `/a/${artifactId}#comments`);
  }
  if (action === "visibility") {
    const visibility = form.get("visibility");
    if (visibility !== "public" && visibility !== "organization") return artifactNoticePage(REFUSED_NOTICE);
    yield* artifacts.setVisibility(user, artifactId, visibility);
    return seeOther(request, `/a/${artifactId}`);
  }
  if (action === "delete" && form.get("confirm") === "yes") {
    yield* artifacts.remove(user, artifactId);
    return seeOther(request, "/a");
  }
  return artifactNoticePage(REFUSED_NOTICE);
});
