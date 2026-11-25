const KEY_BYTES = 32;
const IV_BYTES = 12;
const BASE64 = /^[A-Za-z0-9+/]+={0,2}$/u;

function encodeBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
  }
  return btoa(binary);
}

function decodeBase64(value: string): Uint8Array<ArrayBuffer> | null {
  if (value.length % 4 !== 0 || !BASE64.test(value)) return null;
  try {
    const binary = atob(value);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
    return bytes;
  } catch {
    return null;
  }
}

/** Imports the base64 32-byte `ORG_VAULT_KEY` secret. Null when it is missing or malformed. */
export async function importOrgVaultKey(secret: string | undefined): Promise<CryptoKey | null> {
  const raw = secret?.trim() ? decodeBase64(secret.trim()) : null;
  if (!raw || raw.length !== KEY_BYTES) return null;
  return crypto.subtle.importKey("raw", raw, "AES-GCM", false, ["encrypt", "decrypt"]);
}

/** AES-256-GCM with a random 12-byte IV. Returns base64(iv || ciphertext). */
export async function encryptOrgVaultValue(key: CryptoKey, aad: string, plaintext: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const sealed = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: "AES-GCM", iv, additionalData: new TextEncoder().encode(aad) },
      key,
      new TextEncoder().encode(plaintext),
    ),
  );
  const out = new Uint8Array(IV_BYTES + sealed.length);
  out.set(iv, 0);
  out.set(sealed, IV_BYTES);
  return encodeBase64(out);
}

/** Returns the plaintext, or null when the data, key or AAD do not match. */
export async function decryptOrgVaultValue(key: CryptoKey, aad: string, stored: string): Promise<string | null> {
  const bytes = decodeBase64(stored);
  if (!bytes || bytes.length <= IV_BYTES) return null;
  try {
    const plain = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: bytes.subarray(0, IV_BYTES), additionalData: new TextEncoder().encode(aad) },
      key,
      bytes.subarray(IV_BYTES),
    );
    return new TextDecoder().decode(plain);
  } catch {
    return null;
  }
}
