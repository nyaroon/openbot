import { createFileRoute } from "@tanstack/solid-router";
import { Effect } from "effect";
import { ARTIFACT_BODY_LIMIT, type ArtifactView, readArtifactPublishInput } from "../../server/artifacts";
import { runApiResponse } from "../../server/effect-runtime";
import { readJsonObject } from "../../server/json-body";
import { apiError, artifactErrorResponse, json, requestArtifacts, requestUser } from "../../server/request-auth";

function withUrl(request: Request, artifact: ArtifactView) {
  return { ...artifact, url: new URL(`/a/${artifact.id}`, request.url).toString() };
}

export const Route = createFileRoute("/v1/artifacts")({
  server: {
    handlers: {
      GET: ({ request }) =>
        runApiResponse(
          Effect.gen(function* () {
            const user = yield* requestUser(request);
            if (!user) return apiError(401, "unauthorized", "Sign in is required.");
            const artifacts = yield* requestArtifacts().list(user);
            return json({ artifacts: artifacts.map((artifact) => withUrl(request, artifact)) });
          }),
          artifactErrorResponse,
        ),
      POST: ({ request }) =>
        runApiResponse(
          Effect.gen(function* () {
            const user = yield* requestUser(request);
            if (!user) return apiError(401, "unauthorized", "Sign in is required.");
            const input = readArtifactPublishInput(yield* readJsonObject(request, ARTIFACT_BODY_LIMIT));
            if (!input) return apiError(400, "invalid_artifact", "The artifact is not valid.");
            const artifact = yield* requestArtifacts().publish(user, input);
            return json({ artifact: withUrl(request, artifact) }, input.artifactId === undefined ? 201 : 200);
          }),
          artifactErrorResponse,
        ),
    },
  },
});
