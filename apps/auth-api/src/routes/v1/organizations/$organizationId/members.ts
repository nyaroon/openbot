import { createFileRoute } from "@tanstack/solid-router";
import { Effect } from "effect";
import { runApiResponse } from "../../../../server/effect-runtime";
import { readJsonObject } from "../../../../server/json-body";
import { readMemberInput } from "../../../../server/organizations";
import {
  apiError,
  json,
  organizationErrorResponse,
  requestOrganizations,
  requestUser,
} from "../../../../server/request-auth";

export const Route = createFileRoute("/v1/organizations/$organizationId/members")({
  server: {
    handlers: {
      GET: ({ request, params }) =>
        runApiResponse(
          Effect.gen(function* () {
            const user = yield* requestUser(request);
            if (!user) return apiError(401, "unauthorized", "Sign in is required.");
            return json({ members: yield* requestOrganizations().members(user, params.organizationId) });
          }),
          organizationErrorResponse,
        ),
      POST: ({ request, params }) =>
        runApiResponse(
          Effect.gen(function* () {
            const user = yield* requestUser(request);
            if (!user) return apiError(401, "unauthorized", "Sign in is required.");
            const input = readMemberInput(yield* readJsonObject(request));
            if (!input) return apiError(400, "invalid_member", "The member is not valid.");
            return json(yield* requestOrganizations().addMember(user, params.organizationId, input), 201);
          }),
          organizationErrorResponse,
        ),
    },
  },
});
