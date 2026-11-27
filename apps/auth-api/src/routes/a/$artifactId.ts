import { createFileRoute } from "@tanstack/solid-router";
import { Effect } from "effect";
import { artifactPageError, changeArtifact, showArtifact } from "../../server/artifact-page-routes";
import { runApiResponse } from "../../server/effect-runtime";
import { authErrorResponse, requestArtifacts, requestBrowserUser } from "../../server/request-auth";

const pageError = (error: unknown) => artifactPageError(error) ?? authErrorResponse(error);

export const Route = createFileRoute("/a/$artifactId")({
  server: {
    handlers: {
      GET: ({ request, params }) =>
        runApiResponse(
          Effect.gen(function* () {
            const user = yield* requestBrowserUser(request);
            return yield* showArtifact(requestArtifacts(), user, request, params.artifactId);
          }),
          pageError,
        ),
      POST: ({ request, params }) =>
        runApiResponse(
          Effect.gen(function* () {
            const user = yield* requestBrowserUser(request);
            return yield* changeArtifact(requestArtifacts(), user, request, params.artifactId);
          }),
          pageError,
        ),
    },
  },
});
