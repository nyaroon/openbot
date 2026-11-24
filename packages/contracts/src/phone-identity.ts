import { isDynamicRecord } from "./runtime-values";
import { normalizeEmailAddress } from "./validation";

/**
 * An account that signs in with a WhatsApp number keeps the account service's email-shaped identity:
 * `<digits>@wa.invalid`. The `.invalid` top-level domain can never receive mail (RFC 2606), so no
 * code path can deliver email to it by accident, and every table, invitation and team protocol field
 * that compares identities keeps working with no schema change.
 */
export const PHONE_IDENTITY_DOMAIN = "wa.invalid";

/** Country code for a number written in the national form, with a leading 0. */
const NATIONAL_COUNTRY_CODE = "62";
const PHONE_INPUT_PATTERN = /^\+?[\d\s().-]+$/u;
const MIN_PHONE_DIGITS = 8;
/** E.164 allows at most 15 digits. */
const MAX_PHONE_DIGITS = 15;

/** Digits of the number in international form with no `+`, for example `6281234567890`. */
export function normalizePhoneNumber(value: string): string | null {
  const trimmed = value.trim();
  if (!PHONE_INPUT_PATTERN.test(trimmed)) return null;
  let digits = trimmed.replace(/\D/gu, "");
  if (!trimmed.startsWith("+")) {
    if (digits.startsWith("00")) digits = digits.slice(2);
    else if (digits.startsWith("0")) digits = NATIONAL_COUNTRY_CODE + digits.slice(1);
  }
  if (digits.length < MIN_PHONE_DIGITS || digits.length > MAX_PHONE_DIGITS || digits.startsWith("0")) return null;
  return digits;
}

export function phoneIdentityEmail(phoneDigits: string): string {
  return `${phoneDigits}@${PHONE_IDENTITY_DOMAIN}`;
}

/** The phone digits of a phone identity, or null for a real email address. */
export function phoneFromIdentityEmail(email: string): string | null {
  const [local, domain, ...rest] = email.trim().toLowerCase().split("@");
  if (rest.length > 0 || domain !== PHONE_IDENTITY_DOMAIN || !local) return null;
  return /^\d+$/u.test(local) && normalizePhoneNumber(`+${local}`) === local ? local : null;
}

/**
 * The identity for what a person typed in a sign-in or invitation field: a phone number becomes its
 * phone identity, and an email address stays an email address.
 */
export function normalizeAccountIdentity(value: string): string | null {
  const email = normalizeEmailAddress(value);
  if (email) {
    if (!email.endsWith(`@${PHONE_IDENTITY_DOMAIN}`)) return email;
    return phoneFromIdentityEmail(email) ? email : null;
  }
  const phone = normalizePhoneNumber(value);
  return phone ? phoneIdentityEmail(phone) : null;
}

/** What to show a person for an identity: `+6281234567890` for a phone identity, else the email. */
export function formatAccountIdentity(email: string): string {
  const phone = phoneFromIdentityEmail(email);
  return phone ? `+${phone}` : email;
}

/** Reverse sign-in: the person sends `code` from their own WhatsApp by opening `url`. */
export interface WhatsAppSignIn {
  url: string;
  code: string;
}

const WHATSAPP_LINK_PREFIX = "https://wa.me/";

/**
 * The reverse sign-in part of an account service answer. Undefined unless the link opens WhatsApp,
 * so an answer can never make a client open another site.
 */
export function readWhatsAppSignIn(value: unknown): WhatsAppSignIn | undefined {
  if (!isDynamicRecord(value)) return undefined;
  const { url, code } = value;
  if (typeof url !== "string" || typeof code !== "string" || !url.startsWith(WHATSAPP_LINK_PREFIX)) return undefined;
  return { url, code };
}
