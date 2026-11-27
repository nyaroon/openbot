import { createFileRoute } from "@tanstack/solid-router";
import { Effect } from "effect";
import { artifactPageError, showArtifactList } from "../../server/artifact-page-routes";
import { runApiResponse } from "../../server/effect-runtime";
import { authErrorResponse, requestArtifacts, requestBrowserUser } from "../../server/request-auth";

export const Route = createFileRoute("/a/")({
  server: {
    handlers: {
      GET: ({ request }) =>
        runApiResponse(
          Effect.gen(function* () {
            return yield* showArtifactList(requestArtifacts(), yield* requestBrowserUser(request));
          }),
          (error) => artifactPageError(error) ?? authErrorResponse(error),
        ),
    },
  },
});
