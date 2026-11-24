import { createFileRoute } from "@tanstack/solid-router";
import { Effect } from "effect";
import { runApiResponse } from "../../server/effect-runtime";
import { apiError, authErrorResponse, bearerToken, json, requestAuthService } from "../../server/request-auth";

export const Route = createFileRoute("/v1/me")({
  server: {
    handlers: {
      GET: ({ request }) =>
        runApiResponse(
          Effect.gen(function* () {
            const token = bearerToken(request);
            if (!token) return apiError(401, "unauthorized", "Sign in is required.");
            const service = requestAuthService();
            const user = yield* service.authenticate(token);
            return user ? json(service.withOwnerFlag(user)) : apiError(401, "unauthorized", "The session is invalid.");
          }),
          authErrorResponse,
        ),
    },
  },
});
