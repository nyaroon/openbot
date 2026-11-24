import { isString } from "@openbot/contracts/runtime-values";
import { createFileRoute } from "@tanstack/solid-router";
import { Effect } from "effect";
import { runApiResponse } from "../../../server/effect-runtime";
import { readJsonObject } from "../../../server/json-body";
import { apiError, authErrorResponse, bearerToken, json, requestAuthService } from "../../../server/request-auth";

export const Route = createFileRoute("/v1/admin/accounts")({
  server: {
    handlers: {
      GET: ({ request }) =>
        runApiResponse(
          Effect.gen(function* () {
            const token = bearerToken(request);
            if (!token) return apiError(401, "unauthorized", "Sign in is required.");
            return json({ accounts: yield* requestAuthService().listAccounts(token) });
          }),
          authErrorResponse,
        ),
      POST: ({ request }) =>
        runApiResponse(
          Effect.gen(function* () {
            const token = bearerToken(request);
            if (!token) return apiError(401, "unauthorized", "Sign in is required.");
            const body = yield* readJsonObject(request);
            if (!isString(body.phone)) return apiError(400, "invalid_phone", "Enter a valid WhatsApp number.");
            if (body.name !== undefined && !isString(body.name)) {
              return apiError(400, "invalid_profile_name", "Enter a valid display name.");
            }
            return json(yield* requestAuthService().createAccount(token, { phone: body.phone, name: body.name }), 201);
          }),
          authErrorResponse,
        ),
    },
  },
});
