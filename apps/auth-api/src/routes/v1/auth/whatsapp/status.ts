import { isString } from "@openbot/contracts/runtime-values";
import { createFileRoute } from "@tanstack/solid-router";
import { Effect } from "effect";
import { runApiResponse } from "../../../../server/effect-runtime";
import { readJsonObject } from "../../../../server/json-body";
import { apiError, authErrorResponse, json, requestAuthService } from "../../../../server/request-auth";

export const Route = createFileRoute("/v1/auth/whatsapp/status")({
  server: {
    handlers: {
      // POST keeps the sign-in request identifier out of URLs and request logs.
      POST: ({ request }) =>
        runApiResponse(
          Effect.gen(function* () {
            const body = yield* readJsonObject(request);
            if (!isString(body.challengeId)) {
              return apiError(400, "invalid_sign_in_code", "The sign-in code is invalid.");
            }
            return json(yield* requestAuthService().whatsappSignInState(body.challengeId));
          }),
          (error) => {
            if (error instanceof SyntaxError) {
              return apiError(400, "invalid_json", "The request body is invalid.");
            }
            return authErrorResponse(error);
          },
        ),
    },
  },
});
