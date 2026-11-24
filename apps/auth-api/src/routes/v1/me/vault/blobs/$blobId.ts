import { createFileRoute } from "@tanstack/solid-router";
import { Effect } from "effect";
import { readVaultBlobId, VAULT_BLOB_LIMIT } from "../../../../../server/account-vault-blobs";
import { runApiResponse } from "../../../../../server/effect-runtime";
import { readRequestBytes } from "../../../../../server/json-body";
import {
  accountVaultErrorResponse,
  apiError,
  json,
  requestAccountVaultBlobs,
  requestUser,
} from "../../../../../server/request-auth";

export const Route = createFileRoute("/v1/me/vault/blobs/$blobId")({
  server: {
    handlers: {
      PUT: ({ request, params }) =>
        runApiResponse(
          Effect.gen(function* () {
            const user = yield* requestUser(request);
            if (!user) return apiError(401, "unauthorized", "Sign in is required.");
            const blobId = readVaultBlobId(params.blobId);
            if (!blobId) return apiError(400, "invalid_vault_blob", "The vault blob id is not valid.");
            const bytes = yield* readRequestBytes(request, VAULT_BLOB_LIMIT);
            return json(yield* requestAccountVaultBlobs().put(user.id, blobId, bytes));
          }),
          accountVaultErrorResponse,
        ),
      GET: ({ request, params }) =>
        runApiResponse(
          Effect.gen(function* () {
            const user = yield* requestUser(request);
            if (!user) return apiError(401, "unauthorized", "Sign in is required.");
            const blobId = readVaultBlobId(params.blobId);
            if (!blobId) return apiError(400, "invalid_vault_blob", "The vault blob id is not valid.");
            const body = yield* requestAccountVaultBlobs().get(user.id, blobId);
            return new Response(body, {
              headers: {
                "Content-Type": "application/octet-stream",
                "Cache-Control": "no-store",
                "X-Content-Type-Options": "nosniff",
              },
            });
          }),
          accountVaultErrorResponse,
        ),
      DELETE: ({ request, params }) =>
        runApiResponse(
          Effect.gen(function* () {
            const user = yield* requestUser(request);
            if (!user) return apiError(401, "unauthorized", "Sign in is required.");
            const blobId = readVaultBlobId(params.blobId);
            if (!blobId) return apiError(400, "invalid_vault_blob", "The vault blob id is not valid.");
            return json(yield* requestAccountVaultBlobs().remove(user.id, blobId));
          }),
          accountVaultErrorResponse,
        ),
    },
  },
});
