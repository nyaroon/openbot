import { createCipheriv, createDecipheriv, randomBytes, scrypt } from "node:crypto";
import { type DynamicRecord, isDynamicRecord, isString } from "@openbot/contracts/runtime-values";
import { sourceText } from "@openbot/i18n/source";

export const UNIVERSAL_PASSPHRASE_MIN = 10;
export const UNIVERSAL_PASSPHRASE_MAX = 256;

const KEY_BYTES = 32;
const SALT_BYTES = 16;
const NONCE_BYTES = 12;
const TAG_BYTES = 16;
const COST_MIN = 2 ** 15;
const COST_MAX = 2 ** 20;
const KEY_AAD = "openbot-universal-vault:v1:key:";
const ITEM_AAD = "openbot-universal-vault:v1:item:";
const BLOB_AAD = "openbot-universal-vault:v1:blob:";

export type UniversalItemKind = "login" | "card" | "contact" | "apiKey" | "device" | "mcp" | "skill";

export interface UniversalKdf {
  name: "scrypt";
  n: number;
  r: number;
  p: number;
}

export interface UniversalKeyMaterial {
  kdf: UniversalKdf;
  salt: string;
  wrappedKey: string;
}

export const UNIVERSAL_KDF: UniversalKdf = { name: "scrypt", n: 2 ** 17, r: 8, p: 1 };

export class UniversalVaultWrongPassphraseError extends Error {
  constructor() {
    super(sourceText("error.vault.universalWrongPassphrase"));
  }
}

export class UniversalVaultDataError extends Error {
  constructor(message: string) {
    super(message);
  }
}

export function requireStrongPassphrase(passphrase: string): void {
  if (passphrase.normalize("NFKC").length < UNIVERSAL_PASSPHRASE_MIN)
    throw new Error(sourceText("error.vault.universalPassphraseShort"));
}

function validKdf(value: unknown): UniversalKdf | null {
  if (!isDynamicRecord(value) || value.name !== "scrypt") return null;
  const { n, r, p } = value;
  if (typeof n !== "number" || typeof r !== "number" || typeof p !== "number") return null;
  const valid =
    Number.isInteger(n) &&
    n >= COST_MIN &&
    n <= COST_MAX &&
    (n & (n - 1)) === 0 &&
    Number.isInteger(r) &&
    r >= 1 &&
    r <= 16 &&
    Number.isInteger(p) &&
    p >= 1 &&
    p <= 4;
  return valid ? { name: "scrypt", n, r, p } : null;
}

export function readUniversalKeyMaterial(value: unknown): UniversalKeyMaterial {
  if (!isDynamicRecord(value)) throw new UniversalVaultDataError("The vault key data is not valid.");
  const kdf = validKdf(value.kdf);
  if (!kdf || !isString(value.salt) || !isString(value.wrappedKey))
    throw new UniversalVaultDataError("The vault key data is not valid.");
  return { kdf, salt: value.salt, wrappedKey: value.wrappedKey };
}

function deriveKek(passphrase: string, salt: Buffer, kdf: UniversalKdf): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(
      passphrase.normalize("NFKC"),
      salt,
      KEY_BYTES,
      { N: kdf.n, r: kdf.r, p: kdf.p, maxmem: 256 * kdf.n * kdf.r },
      (error, key) => (error ? reject(new UniversalVaultDataError("Key derivation failed.")) : resolve(key)),
    );
  });
}

function seal(key: Buffer, aad: string, plaintext: Buffer): { nonce: Buffer; sealed: Buffer } {
  const nonce = randomBytes(NONCE_BYTES);
  const cipher = createCipheriv("aes-256-gcm", key, nonce);
  cipher.setAAD(Buffer.from(aad, "utf8"));
  const body = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  return { nonce, sealed: Buffer.concat([body, cipher.getAuthTag()]) };
}

function open(key: Buffer, aad: string, nonce: Buffer, sealed: Buffer): Buffer {
  if (nonce.length !== NONCE_BYTES || sealed.length < TAG_BYTES) throw new UniversalVaultDataError("Invalid data.");
  const decipher = createDecipheriv("aes-256-gcm", key, nonce);
  decipher.setAAD(Buffer.from(aad, "utf8"));
  decipher.setAuthTag(sealed.subarray(sealed.length - TAG_BYTES));
  return Buffer.concat([decipher.update(sealed.subarray(0, sealed.length - TAG_BYTES)), decipher.final()]);
}

async function wrapDataKey(dek: Buffer, passphrase: string, userId: string): Promise<UniversalKeyMaterial> {
  const salt = randomBytes(SALT_BYTES);
  const kek = await deriveKek(passphrase, salt, UNIVERSAL_KDF);
  try {
    const { nonce, sealed } = seal(kek, KEY_AAD + userId, dek);
    return {
      kdf: { ...UNIVERSAL_KDF },
      salt: salt.toString("base64"),
      wrappedKey: Buffer.concat([nonce, sealed]).toString("base64"),
    };
  } finally {
    kek.fill(0);
  }
}

export async function createUniversalVaultKey(
  passphrase: string,
  userId: string,
): Promise<{ dek: Buffer; material: UniversalKeyMaterial }> {
  requireStrongPassphrase(passphrase);
  const dek = randomBytes(KEY_BYTES);
  return { dek, material: await wrapDataKey(dek, passphrase, userId) };
}

export async function unwrapUniversalVaultKey(
  material: UniversalKeyMaterial,
  passphrase: string,
  userId: string,
): Promise<Buffer> {
  const kdf = validKdf(material.kdf);
  if (!kdf) throw new UniversalVaultDataError("The vault key data is not valid.");
  const salt = Buffer.from(material.salt, "base64");
  const wrapped = Buffer.from(material.wrappedKey, "base64");
  if (salt.length < SALT_BYTES || wrapped.length !== NONCE_BYTES + KEY_BYTES + TAG_BYTES)
    throw new UniversalVaultDataError("The vault key data is not valid.");
  const kek = await deriveKek(passphrase, salt, kdf);
  try {
    return open(kek, KEY_AAD + userId, wrapped.subarray(0, NONCE_BYTES), wrapped.subarray(NONCE_BYTES));
  } catch {
    throw new UniversalVaultWrongPassphraseError();
  } finally {
    kek.fill(0);
  }
}

export async function rewrapUniversalVaultKey(
  dek: Buffer,
  newPassphrase: string,
  userId: string,
): Promise<UniversalKeyMaterial> {
  requireStrongPassphrase(newPassphrase);
  return wrapDataKey(dek, newPassphrase, userId);
}

export function canonicalJson(value: unknown): string {
  if (Array.isArray(value))
    return `[${value.map((entry) => canonicalJson(entry === undefined ? null : entry)).join(",")}]`;
  if (isDynamicRecord(value)) {
    const entries = Object.keys(value)
      .sort()
      .flatMap((key) => {
        const entry = value[key];
        return entry === undefined ? [] : [`${JSON.stringify(key)}:${canonicalJson(entry)}`];
      });
    return `{${entries.join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}

function itemAad(userId: string, itemId: string, kind: UniversalItemKind): string {
  return `${ITEM_AAD}${userId}:${itemId}:${kind}`;
}

export function encryptUniversalItem(
  dek: Buffer,
  userId: string,
  itemId: string,
  kind: UniversalItemKind,
  plain: DynamicRecord,
): string {
  const { nonce, sealed } = seal(dek, itemAad(userId, itemId, kind), Buffer.from(canonicalJson(plain), "utf8"));
  return JSON.stringify({ v: 1, nonce: nonce.toString("base64"), ct: sealed.toString("base64") });
}

export function decryptUniversalItem(
  dek: Buffer,
  userId: string,
  itemId: string,
  kind: UniversalItemKind,
  ciphertext: string,
): DynamicRecord {
  try {
    const envelope = JSON.parse(ciphertext);
    if (!isDynamicRecord(envelope) || envelope.v !== 1 || !isString(envelope.nonce) || !isString(envelope.ct))
      throw new UniversalVaultDataError("Invalid data.");
    const plain = open(
      dek,
      itemAad(userId, itemId, kind),
      Buffer.from(envelope.nonce, "base64"),
      Buffer.from(envelope.ct, "base64"),
    );
    const value = JSON.parse(plain.toString("utf8"));
    if (!isDynamicRecord(value)) throw new UniversalVaultDataError("Invalid data.");
    return value;
  } catch {
    throw new UniversalVaultDataError("The item could not be decrypted.");
  }
}

function blobAad(userId: string, blobId: string): string {
  return `${BLOB_AAD}${userId}:${blobId}`;
}

export function encryptUniversalBlob(dek: Buffer, userId: string, blobId: string, bytes: Uint8Array): Buffer {
  const { nonce, sealed } = seal(dek, blobAad(userId, blobId), Buffer.from(bytes));
  return Buffer.concat([nonce, sealed]);
}

export function decryptUniversalBlob(dek: Buffer, userId: string, blobId: string, blob: Uint8Array): Buffer {
  const bytes = Buffer.from(blob);
  try {
    return open(dek, blobAad(userId, blobId), bytes.subarray(0, NONCE_BYTES), bytes.subarray(NONCE_BYTES));
  } catch {
    throw new UniversalVaultDataError("The blob could not be decrypted.");
  }
}
