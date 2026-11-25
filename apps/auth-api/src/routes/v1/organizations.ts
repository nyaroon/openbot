import { createFileRoute } from "@tanstack/solid-router";
import { Effect } from "effect";
import { runApiResponse } from "../../server/effect-runtime";
import { readJsonObject } from "../../server/json-body";
import { readOrganizationInput } from "../../server/organizations";
import {
  apiError,
  json,
  organizationErrorResponse,
  requestOrganizations,
  requestUser,
} from "../../server/request-auth";

export const Route = createFileRoute("/v1/organizations")({
  server: {
    handlers: {
      GET: ({ request }) =>
        runApiResponse(
          Effect.gen(function* () {
            const user = yield* requestUser(request);
            if (!user) return apiError(401, "unauthorized", "Sign in is required.");
            const organizations = requestOrganizations();
            return json({
              organizations: yield* organizations.list(user),
              platformOwner: organizations.isPlatformOwner(user),
            });
          }),
          organizationErrorResponse,
        ),
      POST: ({ request }) =>
        runApiResponse(
          Effect.gen(function* () {
            const user = yield* requestUser(request);
            if (!user) return apiError(401, "unauthorized", "Sign in is required.");
            const input = readOrganizationInput(yield* readJsonObject(request));
            if (!input) return apiError(400, "invalid_organization", "The organization is not valid.");
            return json(yield* requestOrganizations().create(user, input), 201);
          }),
          organizationErrorResponse,
        ),
    },
  },
});
