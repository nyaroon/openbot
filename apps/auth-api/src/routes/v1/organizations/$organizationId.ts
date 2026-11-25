import { createFileRoute } from "@tanstack/solid-router";
import { Effect } from "effect";
import { runApiResponse } from "../../../server/effect-runtime";
import { readJsonObject } from "../../../server/json-body";
import { readOrganizationName } from "../../../server/organizations";
import {
  apiError,
  json,
  organizationErrorResponse,
  requestOrganizations,
  requestUser,
} from "../../../server/request-auth";

export const Route = createFileRoute("/v1/organizations/$organizationId")({
  server: {
    handlers: {
      GET: ({ request, params }) =>
        runApiResponse(
          Effect.gen(function* () {
            const user = yield* requestUser(request);
            if (!user) return apiError(401, "unauthorized", "Sign in is required.");
            return json(yield* requestOrganizations().get(user, params.organizationId));
          }),
          organizationErrorResponse,
        ),
      PATCH: ({ request, params }) =>
        runApiResponse(
          Effect.gen(function* () {
            const user = yield* requestUser(request);
            if (!user) return apiError(401, "unauthorized", "Sign in is required.");
            const name = readOrganizationName((yield* readJsonObject(request)).name);
            if (!name) return apiError(400, "invalid_organization", "The organization name is not valid.");
            return json(yield* requestOrganizations().rename(user, params.organizationId, name));
          }),
          organizationErrorResponse,
        ),
      DELETE: ({ request, params }) =>
        runApiResponse(
          Effect.gen(function* () {
            const user = yield* requestUser(request);
            if (!user) return apiError(401, "unauthorized", "Sign in is required.");
            return json(yield* requestOrganizations().remove(user, params.organizationId));
          }),
          organizationErrorResponse,
        ),
    },
  },
});
