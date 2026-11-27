import { createFileRoute } from "@tanstack/solid-router";
import { Effect } from "effect";
import { createAdminAccount } from "../../../server/admin-accounts";
import { runApiResponse } from "../../../server/effect-runtime";
import { readJsonObject } from "../../../server/json-body";
import {
  apiError,
  authErrorResponse,
  bearerToken,
  json,
  requestAuthService,
  requestOrganizations,
  requestUser,
} from "../../../server/request-auth";

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
            const user = yield* requestUser(request);
            if (!token || !user) return apiError(401, "unauthorized", "Sign in is required.");
            const body = yield* readJsonObject(request);
            const services = { auth: requestAuthService(), organizations: requestOrganizations() };
            return json(yield* createAdminAccount(services, token, user, body), 201);
          }),
          authErrorResponse,
        ),
    },
  },
});
