import { Effect } from "effect";

const SEND_TIMEOUT_MS = 10_000;
let warnedBadUrl = false;

export type OperatorAlert = (text: string) => Effect.Effect<void>;

export function createOperatorAlert(
  webhookUrl: string | undefined,
  fetch: (input: string, init: RequestInit) => Promise<Response>,
): OperatorAlert | null {
  const value = webhookUrl?.trim();
  if (!value) return null;
  const url = URL.parse(value);
  if (url?.protocol !== "https:") {
    if (!warnedBadUrl) console.warn("OPERATOR_ALERT_WEBHOOK_URL is not an HTTPS URL. Operator alerts are off.");
    warnedBadUrl = true;
    return null;
  }
  const target = url.href;
  return (text) =>
    Effect.tryPromise({
      try: (signal) =>
        fetch(target, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content: text, allowed_mentions: { parse: [] } }),
          signal: AbortSignal.any([signal, AbortSignal.timeout(SEND_TIMEOUT_MS)]),
        }),
      catch: () => "network",
    }).pipe(
      Effect.flatMap((response) => (response.ok ? Effect.void : Effect.fail(`http_${response.status}`))),
      Effect.catch((error) => Effect.sync(() => console.warn("Operator alert failed.", { error }))),
    );
}
