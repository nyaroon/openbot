import { createFileRoute } from "@tanstack/solid-router";
import { Effect } from "effect";
import { runApiResponse } from "../../../../../server/effect-runtime";
import { readOrgVaultPageQuery } from "../../../../../server/organizations";
import {
  apiError,
  json,
  organizationErrorResponse,
  requestOrganizations,
  requestUser,
} from "../../../../../server/request-auth";

export const Route = createFileRoute("/v1/organizations/$organizationId/vault/items")({
  server: {
    handlers: {
      GET: ({ request, params }) =>
        runApiResponse(
          Effect.gen(function* () {
            const user = yield* requestUser(request);
            if (!user) return apiError(401, "unauthorized", "Sign in is required.");
            const query = readOrgVaultPageQuery(new URL(request.url));
            if (!query) return apiError(400, "invalid_query", "The vault query is not valid.");
            return json(yield* requestOrganizations().vaultItems(user, params.organizationId, query));
          }),
          organizationErrorResponse,
        ),
    },
  },
});
