import type { WorkerBindings } from "./types";

const FORWARD_TIMEOUT_MS = 10_000;
const PASSED_HEADERS = new Set(["content-type", "user-agent"]);
const BLOCKED_HEADERS = new Set(["x-real-ip"]);

export type KirimiForwardBindings = Pick<WorkerBindings, "KIRIMI_WEBHOOK_FORWARD_URL">;

/**
 * Kirimi allows one webhook address per device. When another system also needs the incoming
 * messages, this is its address. Null when unset or not an https address.
 */
export function readKirimiForwardUrl(bindings: KirimiForwardBindings): string | null {
  const value = bindings.KIRIMI_WEBHOOK_FORWARD_URL?.trim();
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

/** The headers the other system needs to check Kirimi's signature, without the caller's address. */
export function forwardedKirimiHeaders(incoming: Headers): Headers {
  const headers = new Headers();
  incoming.forEach((value, name) => {
    const lower = name.toLowerCase();
    if (BLOCKED_HEADERS.has(lower) || lower.startsWith("x-forwarded-")) return;
    if (PASSED_HEADERS.has(lower) || lower.startsWith("x-")) headers.set(name, value);
  });
  return headers;
}

/**
 * Sends the same bytes on, so a signature over the body still matches. A failure here never reaches
 * Kirimi: this service has already taken the message.
 */
export async function forwardKirimiWebhook(
  url: string,
  incoming: Headers,
  body: ArrayBuffer,
  fetcher: typeof fetch = fetch,
): Promise<void> {
  try {
    await fetcher(url, {
      method: "POST",
      headers: forwardedKirimiHeaders(incoming),
      body,
      signal: AbortSignal.timeout(FORWARD_TIMEOUT_MS),
    });
  } catch {
    // The other system is unreachable. Nothing to retry from here.
  }
}
