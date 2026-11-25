import { createFileRoute } from "@tanstack/solid-router";
import { Effect } from "effect";
import { runApiResponse } from "../../../../../../server/effect-runtime";
import {
  apiError,
  json,
  organizationErrorResponse,
  requestOrganizations,
  requestUser,
} from "../../../../../../server/request-auth";

export const Route = createFileRoute("/v1/organizations/$organizationId/servers/$hostId/join")({
  server: {
    handlers: {
      POST: ({ request, params }) =>
        runApiResponse(
          Effect.gen(function* () {
            const user = yield* requestUser(request);
            if (!user) return apiError(401, "unauthorized", "Sign in is required.");
            return json(yield* requestOrganizations().joinServer(user, params.organizationId, params.hostId));
          }),
          organizationErrorResponse,
        ),
    },
  },
});
