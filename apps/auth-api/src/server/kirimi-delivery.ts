import { normalizePhoneNumber, phoneFromIdentityEmail } from "@openbot/contracts/phone-identity";
import { type DynamicRecord, isDynamicRecord } from "@openbot/contracts/runtime-values";
import { normalizeOneTimeCode } from "@openbot/contracts/validation";
import { Effect } from "effect";
import { EmailDeliveryError } from "./email-delivery-error";
import { RATE_LIMITED_DELIVERY_ERROR } from "./smtp-email-delivery";
import type { EmailCodeDelivery, TeamInviteEmailDelivery, WorkerBindings } from "./types";

export type KirimiBindings = Pick<
  WorkerBindings,
  | "KIRIMI_USER_CODE"
  | "KIRIMI_SECRET"
  | "KIRIMI_DEVICE_ID"
  | "KIRIMI_API_URL"
  | "KIRIMI_WABA_NUMBER"
  | "KIRIMI_WABA_ID"
  | "KIRIMI_WEBHOOK_SECRET"
>;

interface KirimiConfig {
  userCode: string;
  secret: string;
  deviceId: string;
  sendMessageUrl: URL;
}

const KIRIMI_API_URL = "https://api.kirimi.id";
const KIRIMI_TIMEOUT_MS = 10_000;
const MIN_WEBHOOK_SECRET_LENGTH = 32;
const REVERSE_MESSAGE_PREFIX = "Masuk Jujurly:";
const REVERSE_CONFIRMED_TEXT = "Kode diterima. Kamu sedang masuk ke Jujurly, kembali ke aplikasinya.";
const MAX_INCOMING_TEXT_LENGTH = 1_000;
const MAX_INCOMING_MESSAGES = 10;
const KIRIMI_MESSAGE_EVENTS = new Set(["message", "message.received"]);
const MAX_CODES_PER_MESSAGE = 3;
/** A sign-in code that stands alone: four and four characters of the code alphabet. */
const SIGN_IN_CODE_PATTERN = /(?<![A-Z0-9])[2-9A-HJ-NP-Z]{4}-?[2-9A-HJ-NP-Z]{4}(?![A-Z0-9])/gu;

/** Null when no Kirimi setting is present. All three are required together. */
export function readKirimiConfig(bindings: KirimiBindings): KirimiConfig | null {
  const userCode = bindings.KIRIMI_USER_CODE?.trim();
  const secret = bindings.KIRIMI_SECRET?.trim();
  const deviceId = bindings.KIRIMI_DEVICE_ID?.trim();
  if (!userCode && !secret && !deviceId) return null;
  if (!userCode || !secret || !deviceId) {
    throw new Error("Kirimi WhatsApp delivery configuration is incomplete.");
  }
  const sendMessageUrl = new URL("/v1/send-message", bindings.KIRIMI_API_URL?.trim() || KIRIMI_API_URL);
  if (sendMessageUrl.protocol !== "https:") throw new Error("KIRIMI_API_URL must use HTTPS.");
  return { userCode, secret, deviceId, sendMessageUrl };
}

/**
 * Reverse sign-in needs the WhatsApp Business number that people write to, and the secret in the
 * path of the webhook that Kirimi calls for an incoming message. Null when neither is set.
 */
export function readKirimiReverseNumber(bindings: KirimiBindings): string | null {
  const number = bindings.KIRIMI_WABA_NUMBER?.trim();
  const webhookSecret = bindings.KIRIMI_WEBHOOK_SECRET?.trim();
  if (!number && !webhookSecret) return null;
  const digits = number ? normalizePhoneNumber(number) : null;
  if (!digits || !webhookSecret || webhookSecret.length < MIN_WEBHOOK_SECRET_LENGTH) {
    throw new Error("Kirimi reverse sign-in needs KIRIMI_WABA_NUMBER and a KIRIMI_WEBHOOK_SECRET of 32 characters.");
  }
  return digits;
}

export function createKirimiReverseCodeDelivery(
  number: string,
  confirmed?: (to: string) => Effect.Effect<void>,
): EmailCodeDelivery {
  return { phoneOnly: true, reverse: { number, ...(confirmed ? { confirmed } : {}) }, send: () => Effect.void };
}

/**
 * The reply that tells a person their sign-in message arrived. It goes out through the WhatsApp
 * Business account, which may answer freely for 24 hours after an incoming message. Null when
 * KIRIMI_WABA_ID or the Kirimi account settings are missing.
 */
export function readKirimiReverseReply(
  bindings: KirimiBindings,
  fetcher: typeof fetch = fetch,
): ((to: string) => Effect.Effect<void>) | null {
  const userCode = bindings.KIRIMI_USER_CODE?.trim();
  const secret = bindings.KIRIMI_SECRET?.trim();
  const wabaId = bindings.KIRIMI_WABA_ID?.trim();
  if (!userCode || !secret || !wabaId) return null;
  const url = new URL("/v1/waba/messages/reply", bindings.KIRIMI_API_URL?.trim() || KIRIMI_API_URL);
  if (url.protocol !== "https:") return null;
  return (to) =>
    Effect.promise(async () => {
      try {
        await fetcher(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            user_code: userCode,
            secret,
            waba_id: wabaId,
            to,
            message: { type: "text", text: REVERSE_CONFIRMED_TEXT },
          }),
          signal: AbortSignal.timeout(KIRIMI_TIMEOUT_MS),
        });
      } catch {
        // The sign-in is already confirmed. A missing reply changes nothing for the person.
      }
    });
}

/** The `wa.me` link that opens WhatsApp with the sign-in message ready to send. */
export function reverseSignInUrl(number: string, code: string): string {
  return `https://wa.me/${number}?text=${encodeURIComponent(`${REVERSE_MESSAGE_PREFIX} ${code}`)}`;
}

export interface IncomingWhatsAppMessage {
  /** Digits of the sender in international form. */
  from: string;
  text: string;
}

/**
 * Incoming text messages of a webhook call. Kirimi names the event `message` (in the body and in the
 * `X-Kirimi-Event` header) and puts the sender in `from`. The message may sit at the top, under
 * `data` or `message`, in a `messages` list, or in the WhatsApp Cloud API shape
 * (`entry[].changes[].value.messages[]`). Other Kirimi events carry no message and give nothing.
 * A field that could also name the receiving number is never read as the sender.
 */
export function incomingWhatsAppMessages(payload: unknown): IncomingWhatsAppMessage[] {
  const found: IncomingWhatsAppMessage[] = [];
  const add = (from: unknown, text: string | null) => {
    const digits = typeof from === "string" ? normalizePhoneNumber(`+${from.replace(/\D/gu, "")}`) : null;
    if (digits && text !== null && text.length <= MAX_INCOMING_TEXT_LENGTH) found.push({ from: digits, text });
  };
  const root = record(payload);
  if (!root) return found;
  if (root.event !== undefined && !KIRIMI_MESSAGE_EVENTS.has(String(root.event))) return found;
  const data = record(root.data);
  for (const holder of [root, data]) {
    for (const entry of list(holder?.entry)) {
      for (const change of list(record(entry)?.changes)) {
        for (const message of list(record(record(change)?.value)?.messages)) {
          const item = record(message);
          add(item?.from, messageText(item));
        }
      }
    }
  }
  if (found.length === 0) {
    const nested = [record(root.message), record(data?.message)];
    const listed = [...list(root.messages), ...list(data?.messages)].map(record);
    for (const item of [data, root, ...nested, ...listed]) {
      // A nested message may leave the sender on the object around it.
      add(item?.from ?? item?.sender ?? data?.from ?? root.from, messageText(item));
      if (found.length > 0 && !listed.includes(item)) break;
    }
  }
  return found.slice(0, MAX_INCOMING_MESSAGES);
}

/** The text of one message object: a string, or a `{ body }` object, under one of the usual names. */
function messageText(item: DynamicRecord | null): string | null {
  if (!item) return null;
  for (const value of [item.text, item.message, item.body, item.content]) {
    if (typeof value === "string") return value;
    const inner = record(value);
    for (const nested of [inner?.body, inner?.text, record(inner?.text)?.body]) {
      if (typeof nested === "string") return nested;
    }
  }
  return null;
}

/** Normalized sign-in codes that a message text contains. */
export function signInCodesInText(text: string): string[] {
  const codes = new Set<string>();
  for (const match of text.toUpperCase().matchAll(SIGN_IN_CODE_PATTERN)) {
    const code = normalizeOneTimeCode(match[0]);
    if (code) codes.add(code);
    if (codes.size === MAX_CODES_PER_MESSAGE) break;
  }
  return [...codes];
}

/** The webhook secret, or null when reverse sign-in is off. */
export function kirimiWebhookSecret(bindings: KirimiBindings): string | null {
  return readKirimiReverseNumber(bindings) ? (bindings.KIRIMI_WEBHOOK_SECRET?.trim() ?? null) : null;
}

function record(value: unknown): DynamicRecord | null {
  return isDynamicRecord(value) ? value : null;
}

function list(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

export function createKirimiCodeDelivery(config: KirimiConfig): EmailCodeDelivery {
  return {
    phoneOnly: true,
    send: (message) => {
      const minutes = Math.max(1, Math.ceil((message.expiresAt - Date.now()) / 60_000));
      return sendWhatsApp(
        config,
        message.email,
        `Kode masuk OpenBot kamu: *${message.code}*\n\nBerlaku ${minutes} menit. Jangan berikan kode ini ke siapa pun.`,
      );
    },
  };
}

export function createKirimiTeamInviteDelivery(config: KirimiConfig): TeamInviteEmailDelivery {
  return {
    send: (message) =>
      sendWhatsApp(
        config,
        message.email,
        `Kamu diundang ke server OpenBot "${message.serverName}" sebagai ${message.role === "admin" ? "admin" : "anggota"}.\n\nBuka tautan ini untuk bergabung:\n${message.inviteUrl}`,
      ),
  };
}

const sendWhatsApp = Effect.fn("KirimiDelivery.send")(function* (config: KirimiConfig, identity: string, text: string) {
  const receiver = phoneFromIdentityEmail(identity);
  if (!receiver) return yield* new EmailDeliveryError({ message: "email_delivery_phone_required" });
  const response = yield* Effect.tryPromise({
    try: (signal) =>
      fetch(config.sendMessageUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_code: config.userCode,
          device_id: config.deviceId,
          receiver,
          message: text,
          secret: config.secret,
        }),
        signal: AbortSignal.any([signal, AbortSignal.timeout(KIRIMI_TIMEOUT_MS)]),
      }),
    // A request that timed out may still have been sent, so the client waits and checks again.
    catch: () => new EmailDeliveryError({ message: "email_delivery_unknown" }),
  });
  if (response.status === 429) return yield* new EmailDeliveryError({ message: RATE_LIMITED_DELIVERY_ERROR });
  // Kirimi reports some failures with HTTP 200 and `success: false`.
  const accepted = response.ok
    ? yield* Effect.tryPromise({
        try: async () => record(await response.json())?.success === true,
        catch: () => new EmailDeliveryError({ message: "email_delivery_kirimi_failed" }),
      })
    : false;
  if (!accepted) return yield* new EmailDeliveryError({ message: "email_delivery_kirimi_failed" });
});
