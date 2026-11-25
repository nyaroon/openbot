import { createFileRoute } from "@tanstack/solid-router";
import { Effect } from "effect";
import { runApiResponse } from "../../../../../../server/effect-runtime";
import { readJsonObject } from "../../../../../../server/json-body";
import {
  ORG_VAULT_ITEM_BODY_LIMIT,
  readOrgVaultItemId,
  readOrgVaultItemInput,
  readOrgVaultRemoval,
} from "../../../../../../server/organizations";
import {
  apiError,
  json,
  organizationErrorResponse,
  requestOrganizations,
  requestUser,
} from "../../../../../../server/request-auth";

export const Route = createFileRoute("/v1/organizations/$organizationId/vault/items/$itemId")({
  server: {
    handlers: {
      PUT: ({ request, params }) =>
        runApiResponse(
          Effect.gen(function* () {
            const user = yield* requestUser(request);
            if (!user) return apiError(401, "unauthorized", "Sign in is required.");
            const itemId = readOrgVaultItemId(params.itemId);
            if (!itemId) return apiError(400, "invalid_org_vault_item", "The vault item id is not valid.");
            const input = readOrgVaultItemInput(yield* readJsonObject(request, ORG_VAULT_ITEM_BODY_LIMIT));
            if (!input) return apiError(400, "invalid_org_vault_item", "The vault item is not valid.");
            return json(yield* requestOrganizations().putVaultItem(user, params.organizationId, itemId, input));
          }),
          organizationErrorResponse,
        ),
      DELETE: ({ request, params }) =>
        runApiResponse(
          Effect.gen(function* () {
            const user = yield* requestUser(request);
            if (!user) return apiError(401, "unauthorized", "Sign in is required.");
            const itemId = readOrgVaultItemId(params.itemId);
            if (!itemId) return apiError(400, "invalid_org_vault_item", "The vault item id is not valid.");
            const input = readOrgVaultRemoval(yield* readJsonObject(request));
            if (!input) return apiError(400, "invalid_org_vault_item", "The vault item request is not valid.");
            return json(yield* requestOrganizations().deleteVaultItem(user, params.organizationId, itemId, input));
          }),
          organizationErrorResponse,
        ),
    },
  },
});
