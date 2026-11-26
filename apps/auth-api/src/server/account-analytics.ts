import { FIRST_TOUCH_CAMPAIGN_FIELDS, type FirstTouch, parseFirstTouch } from "@openbot/contracts/first-touch";
import { ANALYTICS_ENABLED } from "@openbot/contracts/product";
import { isOneOf } from "@openbot/contracts/runtime-values";
import { Effect, Schema } from "effect";

const OPENPANEL_API_URL = "https://analytics.openbot.run/api";
export const ACCOUNT_ANALYTICS_SCHEMA_VERSION = 18;
const SEND_TIMEOUT_MS = 5_000;
const ACCOUNT_ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/u;

const ACCOUNT_SURFACES = ["desktop", "mobile", "web"] as const;
export type AccountSurface = (typeof ACCOUNT_SURFACES)[number];
const ATTRIBUTION_SOURCES = ["sign_in"] as const;
export type AttributionSource = (typeof ATTRIBUTION_SOURCES)[number];

const EMAIL_KINDS = ["sign_in_code", "team_invite", "contact", "owner_transfer"] as const;
export type EmailKind = (typeof EMAIL_KINDS)[number];
const EMAIL_RESULTS = ["accepted", "rate_limited", "unknown", "failed"] as const;
export type EmailResult = (typeof EMAIL_RESULTS)[number];

type AnalyticsProperties = Record<string, string | number | boolean>;

export type AccountAnalyticsEvent =
  | { name: "account_created"; surface: AccountSurface; firstTouch: FirstTouch | null }
  | { name: "account_attributed"; via: AttributionSource; firstTouch: FirstTouch }
  | { name: "email_sent" | "email_fallback_sent"; kind: EmailKind; result: EmailResult };

export interface AccountAnalytics {
  track(accountId: string | null, event: AccountAnalyticsEvent): void;
}

export const NO_ACCOUNT_ANALYTICS: AccountAnalytics = { track: () => undefined };

export interface AccountAnalyticsOptions {
  clientId: string | undefined;
  clientSecret: string | undefined;
  fetch: (input: string, init: RequestInit) => Promise<Response>;
  schedule: (send: Effect.Effect<void>) => void;
}

class AnalyticsDeliveryError extends Schema.TaggedError<AnalyticsDeliveryError>()("AnalyticsDeliveryError", {}) {}

interface OpenPanelBody {
  type: "track";
  payload: { name: string; profileId?: string; properties: AnalyticsProperties };
}

export function createAccountAnalytics(options: AccountAnalyticsOptions): AccountAnalytics {
  const clientId = options.clientId?.trim();
  const clientSecret = options.clientSecret?.trim();
  if (!ANALYTICS_ENABLED || !clientId || !clientSecret) return NO_ACCOUNT_ANALYTICS;
  const post = Effect.fn("AccountAnalytics.post")(function* (body: OpenPanelBody) {
    const response = yield* Effect.tryPromise({
      try: (signal) =>
        options.fetch(`${OPENPANEL_API_URL}/track`, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "openpanel-client-id": clientId,
            "openpanel-client-secret": clientSecret,
          },
          body: JSON.stringify(body),
          signal: AbortSignal.any([signal, AbortSignal.timeout(SEND_TIMEOUT_MS)]),
        }),
      catch: () => new AnalyticsDeliveryError({}),
    });
    if (!response.ok) {
      console.warn("Account analytics send failed.", {
        status: response.status,
      });
    }
  });
  return {
    track(accountId, event) {
      const properties = accountEventProperties(event);
      if (!properties || (accountId !== null && !ACCOUNT_ID_PATTERN.test(accountId))) return;
      const send = post({
        type: "track",
        payload: { name: event.name, ...(accountId === null ? {} : { profileId: accountId }), properties },
      }).pipe(Effect.catch(() => Effect.sync(() => console.warn("Account analytics send failed."))));
      options.schedule(send);
    },
  };
}

function accountEventProperties(event: AccountAnalyticsEvent): AnalyticsProperties | null {
  const properties: AnalyticsProperties = {
    surface: "account_api",
    environment: "production",
    event_schema_version: ACCOUNT_ANALYTICS_SCHEMA_VERSION,
  };
  if (event.name === "account_created") {
    if (!isOneOf(ACCOUNT_SURFACES, event.surface)) return null;
    return { ...properties, sign_in_surface: event.surface, ...firstTouchProperties(event.firstTouch) };
  }
  if (event.name === "account_attributed") {
    const touch = firstTouchProperties(event.firstTouch);
    if (!isOneOf(ATTRIBUTION_SOURCES, event.via) || !touch.first_touch_source) return null;
    return { ...properties, recorded_via: event.via, ...touch };
  }
  if (event.name === "email_sent" || event.name === "email_fallback_sent") {
    if (!isOneOf(EMAIL_KINDS, event.kind) || !isOneOf(EMAIL_RESULTS, event.result)) return null;
    return { ...properties, kind: event.kind, result: event.result };
  }
  return null;
}

const FIRST_TOUCH_CAMPAIGN_PROPERTIES = {
  utmSource: "first_touch_utm_source",
  utmMedium: "first_touch_utm_medium",
  utmCampaign: "first_touch_utm_campaign",
  utmContent: "first_touch_utm_content",
  utmTerm: "first_touch_utm_term",
} as const satisfies Record<(typeof FIRST_TOUCH_CAMPAIGN_FIELDS)[number], string>;

export const FIRST_TOUCH_PROPERTIES = [
  "first_touch_source",
  "first_touch_platform",
  "first_touch_landing_page",
  "first_touch_date",
  ...Object.values(FIRST_TOUCH_CAMPAIGN_PROPERTIES),
];

export function firstTouchProperties(value: FirstTouch | null): Record<string, string> {
  const touch = parseFirstTouch(value);
  if (!touch) return {};
  const properties: Record<string, string> = {
    first_touch_source: touch.acquisitionSource,
    first_touch_platform: touch.sourcePlatform,
    first_touch_landing_page: touch.landingPage,
    first_touch_date: touch.firstVisitOn,
  };
  for (const field of FIRST_TOUCH_CAMPAIGN_FIELDS) {
    const campaign = touch[field];
    if (campaign) properties[FIRST_TOUCH_CAMPAIGN_PROPERTIES[field]] = campaign;
  }
  return properties;
}
