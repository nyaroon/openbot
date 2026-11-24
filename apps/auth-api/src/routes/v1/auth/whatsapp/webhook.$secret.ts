import { createFileRoute } from "@tanstack/solid-router";
import { Effect } from "effect";
import { adminTokenMatches } from "../../../../server/admin-token";
import { runApiResponse } from "../../../../server/effect-runtime";
import { readJsonObject } from "../../../../server/json-body";
import { incomingWhatsAppMessages } from "../../../../server/kirimi-delivery";
import {
  apiError,
  authErrorResponse,
  json,
  requestAuthService,
  requestKirimiWebhookSecret,
} from "../../../../server/request-auth";

const WEBHOOK_BODY_LIMIT = 256 * 1024;

/**
 * Kirimi calls this for an incoming WhatsApp message. The secret in the path is the only proof that
 * the call comes from Kirimi, so the URL must stay private.
 */
export const Route = createFileRoute("/v1/auth/whatsapp/webhook/$secret")({
  server: {
    handlers: {
      POST: ({ request, params }) =>
        runApiResponse(
          Effect.gen(function* () {
            const secret = requestKirimiWebhookSecret();
            if (!secret || !(yield* adminTokenMatches(secret, params.secret))) {
              return apiError(404, "not_found", "Not found.");
            }
            const body = yield* readJsonObject(request, WEBHOOK_BODY_LIMIT);
            yield* requestAuthService().confirmWhatsAppSignIn(incomingWhatsAppMessages(body));
            // The answer never says whether a code matched.
            return json({ received: true });
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
