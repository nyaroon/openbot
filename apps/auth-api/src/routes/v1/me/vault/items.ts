import { createFileRoute } from "@tanstack/solid-router";
import { Effect } from "effect";
import { readVaultPageQuery } from "../../../../server/account-vault";
import { runApiResponse } from "../../../../server/effect-runtime";
import {
  accountVaultErrorResponse,
  apiError,
  json,
  requestAccountVault,
  requestUser,
} from "../../../../server/request-auth";

export const Route = createFileRoute("/v1/me/vault/items")({
  server: {
    handlers: {
      GET: ({ request }) =>
        runApiResponse(
          Effect.gen(function* () {
            const user = yield* requestUser(request);
            if (!user) return apiError(401, "unauthorized", "Sign in is required.");
            const query = readVaultPageQuery(new URL(request.url));
            if (!query) return apiError(400, "invalid_vault_query", "The vault page request is not valid.");
            return json(yield* requestAccountVault().items(user.id, query));
          }),
          accountVaultErrorResponse,
        ),
    },
  },
});
