import { isString } from "@openbot/contracts/runtime-values";
import { createFileRoute } from "@tanstack/solid-router";
import { Effect } from "effect";
import { normalizeMobileDevice } from "../../../../server/auth-service";
import { runApiResponse } from "../../../../server/effect-runtime";
import { ExtensionSignInError } from "../../../../server/extension-sign-in";
import { readJsonObject } from "../../../../server/json-body";
import { apiError, extensionSignInErrorResponse, json, requestExtensionSignIn } from "../../../../server/request-auth";

export const Route = createFileRoute("/v1/auth/extension/exchange")({
  server: {
    handlers: {
      POST: ({ request }) =>
        runApiResponse(
          Effect.gen(function* () {
            const body = yield* readJsonObject(request);
            if (!isString(body.code) || !isString(body.codeVerifier)) {
              return apiError(400, "invalid_sign_in_code", "The sign-in did not finish. Try again.");
            }
            const { deviceId, deviceName, platform } = body;
            if (
              !isString(deviceId) ||
              !isString(deviceName) ||
              (platform !== "ios" && platform !== "android" && platform !== "unknown")
            ) {
              return apiError(400, "invalid_mobile_device", "The mobile device is invalid.");
            }
            const device = yield* Effect.try({
              try: () => normalizeMobileDevice({ id: deviceId, name: deviceName, platform }),
              catch: () => new ExtensionSignInError(400, "invalid_mobile_device", "The mobile device is invalid."),
            });
            return json(
              yield* requestExtensionSignIn().exchange({ code: body.code, codeVerifier: body.codeVerifier, device }),
            );
          }),
          extensionSignInErrorResponse,
        ),
    },
  },
});
