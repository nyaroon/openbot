import { createFileRoute } from "@tanstack/solid-router";
import { Effect } from "effect";
import { runApiResponse } from "../../../../server/effect-runtime";
import {
  apiError,
  json,
  organizationErrorResponse,
  requestOrganizations,
  requestUser,
} from "../../../../server/request-auth";

export const Route = createFileRoute("/v1/organizations/$organizationId/servers")({
  server: {
    handlers: {
      GET: ({ request, params }) =>
        runApiResponse(
          Effect.gen(function* () {
            const user = yield* requestUser(request);
            if (!user) return apiError(401, "unauthorized", "Sign in is required.");
            return json(yield* requestOrganizations().servers(user, params.organizationId));
          }),
          organizationErrorResponse,
        ),
    },
  },
});
