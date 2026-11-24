import { createFileRoute } from "@tanstack/solid-router";
import { Effect } from "effect";
import {
  readVaultItemId,
  readVaultItemInput,
  readVaultItemRemoval,
  VAULT_ITEM_BODY_LIMIT,
} from "../../../../../server/account-vault";
import { runApiResponse } from "../../../../../server/effect-runtime";
import { readJsonObject } from "../../../../../server/json-body";
import {
  accountVaultErrorResponse,
  apiError,
  json,
  requestAccountVault,
  requestUser,
} from "../../../../../server/request-auth";

export const Route = createFileRoute("/v1/me/vault/items/$itemId")({
  server: {
    handlers: {
      PUT: ({ request, params }) =>
        runApiResponse(
          Effect.gen(function* () {
            const user = yield* requestUser(request);
            if (!user) return apiError(401, "unauthorized", "Sign in is required.");
            const itemId = readVaultItemId(params.itemId);
            if (!itemId) return apiError(400, "invalid_vault_item", "The vault item id is not valid.");
            const input = readVaultItemInput(yield* readJsonObject(request, VAULT_ITEM_BODY_LIMIT));
            if (!input) return apiError(400, "invalid_vault_item", "The vault item is not valid.");
            return json(yield* requestAccountVault().putItem(user.id, itemId, input));
          }),
          accountVaultErrorResponse,
        ),
      DELETE: ({ request, params }) =>
        runApiResponse(
          Effect.gen(function* () {
            const user = yield* requestUser(request);
            if (!user) return apiError(401, "unauthorized", "Sign in is required.");
            const itemId = readVaultItemId(params.itemId);
            if (!itemId) return apiError(400, "invalid_vault_item", "The vault item id is not valid.");
            const input = readVaultItemRemoval(yield* readJsonObject(request));
            if (!input) return apiError(400, "invalid_vault_item", "The vault item request is not valid.");
            return json(yield* requestAccountVault().removeItem(user.id, itemId, input));
          }),
          accountVaultErrorResponse,
        ),
    },
  },
});
