import { ACCOUNT_SERVICE_ORIGIN } from "@openbot/contracts/product";
import { createFileRoute } from "@tanstack/solid-router";
import { Effect } from "effect";
import { sendContactMessage } from "../../server/contact-message";
import { runApiResponse } from "../../server/effect-runtime";
import { readJsonObject } from "../../server/json-body";
import { apiError, authErrorResponse, requestContactMessageServices } from "../../server/request-auth";
import { requestSourceIp } from "../../server/source-ip";

function isSameOriginRequest(request: Request): boolean {
  const origin = request.headers.get("Origin");
  if (origin === null || origin !== new URL(request.url).origin) return false;
  const fetchSite = request.headers.get("Sec-Fetch-Site");
  return fetchSite === null || fetchSite === "same-origin";
}

export const Route = createFileRoute("/v1/contact")({
  server: {
    handlers: {
      POST: ({ request }) =>
        runApiResponse(
          Effect.gen(function* () {
            if (!isSameOriginRequest(request)) {
              return apiError(
                403,
                "invalid_contact_origin",
                `Open the contact form on ${new URL(ACCOUNT_SERVICE_ORIGIN).host}.`,
              );
            }
            const body = yield* readJsonObject(request);
            yield* sendContactMessage(requestContactMessageServices(), body, requestSourceIp(request));
            return new Response(null, { status: 204 });
          }),
          authErrorResponse,
        ),
    },
  },
});
