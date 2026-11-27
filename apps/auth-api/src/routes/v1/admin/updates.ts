import { createFileRoute } from "@tanstack/solid-router";
import { Effect } from "effect";
import { runApiResponse } from "../../../server/effect-runtime";
import { readJsonObject } from "../../../server/json-body";
import {
  apiError,
  authErrorResponse,
  json,
  requestUpdateUploadLink,
  requireReleaseUploader,
} from "../../../server/request-auth";

/** Gives the release script a link that uploads one release file. */
export const Route = createFileRoute("/v1/admin/updates")({
  server: {
    handlers: {
      POST: ({ request }) =>
        runApiResponse(
          Effect.gen(function* () {
            if (!(yield* requireReleaseUploader(request))) return apiError(404, "not_found", "Not found.");
            const body = yield* readJsonObject(request, 1_024);
            const file = typeof body.file === "string" ? body.file : "";
            const url = yield* Effect.promise(() => requestUpdateUploadLink(file));
            if (!url) return apiError(400, "invalid_file", "This is not a release file.");
            return json({ url });
          }),
          authErrorResponse,
        ),
    },
  },
});
