import { createFileRoute } from "@tanstack/solid-router";
import { Effect } from "effect";
import { readVaultMetaInput } from "../../../server/account-vault";
import { runApiResponse } from "../../../server/effect-runtime";
import { readJsonObject } from "../../../server/json-body";
import {
  accountVaultErrorResponse,
  apiError,
  json,
  requestAccountVault,
  requestAccountVaultBlobs,
  requestUser,
} from "../../../server/request-auth";

export const Route = createFileRoute("/v1/me/vault")({
  server: {
    handlers: {
      GET: ({ request }) =>
        runApiResponse(
          Effect.gen(function* () {
            const user = yield* requestUser(request);
            if (!user) return apiError(401, "unauthorized", "Sign in is required.");
            return json(yield* requestAccountVault().meta(user.id));
          }),
          accountVaultErrorResponse,
        ),
      PUT: ({ request }) =>
        runApiResponse(
          Effect.gen(function* () {
            const user = yield* requestUser(request);
            if (!user) return apiError(401, "unauthorized", "Sign in is required.");
            const input = readVaultMetaInput(yield* readJsonObject(request));
            if (!input) return apiError(400, "invalid_vault", "The vault key data is not valid.");
            return json(yield* requestAccountVault().putMeta(user.id, input));
          }),
          accountVaultErrorResponse,
        ),
      DELETE: ({ request }) =>
        runApiResponse(
          Effect.gen(function* () {
            const user = yield* requestUser(request);
            if (!user) return apiError(401, "unauthorized", "Sign in is required.");
            yield* requestAccountVaultBlobs().removeAll(user.id);
            return json(yield* requestAccountVault().deleteAll(user.id));
          }),
          accountVaultErrorResponse,
        ),
    },
  },
});
