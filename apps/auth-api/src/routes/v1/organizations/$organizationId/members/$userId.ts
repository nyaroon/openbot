import { createFileRoute } from "@tanstack/solid-router";
import { Effect } from "effect";
import { runApiResponse } from "../../../../../server/effect-runtime";
import { readJsonObject } from "../../../../../server/json-body";
import { readMemberRole } from "../../../../../server/organizations";
import {
  apiError,
  json,
  organizationErrorResponse,
  requestOrganizations,
  requestUser,
} from "../../../../../server/request-auth";

export const Route = createFileRoute("/v1/organizations/$organizationId/members/$userId")({
  server: {
    handlers: {
      PATCH: ({ request, params }) =>
        runApiResponse(
          Effect.gen(function* () {
            const user = yield* requestUser(request);
            if (!user) return apiError(401, "unauthorized", "Sign in is required.");
            const role = readMemberRole(yield* readJsonObject(request));
            if (!role) return apiError(400, "invalid_member", "The member role is not valid.");
            return json(yield* requestOrganizations().setMemberRole(user, params.organizationId, params.userId, role));
          }),
          organizationErrorResponse,
        ),
      DELETE: ({ request, params }) =>
        runApiResponse(
          Effect.gen(function* () {
            const user = yield* requestUser(request);
            if (!user) return apiError(401, "unauthorized", "Sign in is required.");
            return json(yield* requestOrganizations().removeMember(user, params.organizationId, params.userId));
          }),
          organizationErrorResponse,
        ),
    },
  },
});
