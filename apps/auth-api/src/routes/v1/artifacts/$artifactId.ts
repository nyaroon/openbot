import { createFileRoute } from "@tanstack/solid-router";
import { Effect } from "effect";
import { runApiResponse } from "../../../server/effect-runtime";
import { apiError, artifactErrorResponse, json, requestArtifacts, requestUser } from "../../../server/request-auth";

export const Route = createFileRoute("/v1/artifacts/$artifactId")({
  server: {
    handlers: {
      GET: ({ request, params }) =>
        runApiResponse(
          Effect.gen(function* () {
            const user = yield* requestUser(request);
            if (!user) return apiError(401, "unauthorized", "Sign in is required.");
            const page = yield* requestArtifacts().read(user, params.artifactId);
            return json({
              ...page,
              artifact: { ...page.artifact, url: new URL(`/a/${page.artifact.id}`, request.url).toString() },
            });
          }),
          artifactErrorResponse,
        ),
      DELETE: ({ request, params }) =>
        runApiResponse(
          Effect.gen(function* () {
            const user = yield* requestUser(request);
            if (!user) return apiError(401, "unauthorized", "Sign in is required.");
            yield* requestArtifacts().remove(user, params.artifactId);
            return new Response(null, { status: 204, headers: { "Cache-Control": "no-store" } });
          }),
          artifactErrorResponse,
        ),
    },
  },
});
