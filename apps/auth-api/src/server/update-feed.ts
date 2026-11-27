import type { ObjectStorageEnv } from "./s3-object-bucket";

/** Where the files of a desktop release live in the storage bucket. */
const UPDATE_PREFIX = "updates/";
const UPDATE_FILE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,150}\.(?:yml|exe|blockmap|zip|dmg|AppImage)$/u;
const ALGORITHM = "AWS4-HMAC-SHA256";
const encoder = new TextEncoder();

/** How long a download link works. A slow connection must finish a large installer within it. */
export const UPDATE_DOWNLOAD_SECONDS = 6 * 60 * 60;
/** How long an upload link works. */
export const UPDATE_UPLOAD_SECONDS = 60 * 60;

export function isUpdateFile(name: string): boolean {
  return UPDATE_FILE.test(name) && !name.includes("..");
}

/** The feed file names the newest version, so the app must never get an old copy of it. */
export function isUpdateManifest(name: string): boolean {
  return name.endsWith(".yml");
}

export interface UpdateLinkInput {
  env: ObjectStorageEnv;
  method: "GET" | "PUT";
  file: string;
  expiresSeconds: number;
  now: Date;
}

/**
 * A link that reads or writes one release file in the storage bucket for a limited time.
 * Returns null when the storage is not configured or the name is not a release file.
 */
export async function updateFileLink(input: UpdateLinkInput): Promise<string | null> {
  const endpoint = input.env.STORAGE_S3_ENDPOINT?.trim() ?? "";
  const bucket = input.env.STORAGE_S3_BUCKET?.trim() ?? "";
  const accessKeyId = input.env.STORAGE_S3_ACCESS_KEY_ID?.trim() ?? "";
  const secretAccessKey = input.env.STORAGE_S3_SECRET_ACCESS_KEY?.trim() ?? "";
  if (!isUpdateFile(input.file) || !URL.canParse(endpoint) || !bucket || !accessKeyId || !secretAccessKey) return null;
  const region = input.env.STORAGE_S3_REGION?.trim() || "auto";
  const pathStyle = !["false", "0", "no"].includes(input.env.STORAGE_S3_FORCE_PATH_STYLE?.trim().toLowerCase() ?? "");

  const url = new URL(endpoint);
  const basePath = url.pathname.replace(/\/+$/u, "");
  const key = `${UPDATE_PREFIX}${input.file}`.split("/").map(uriEncode).join("/");
  if (pathStyle) url.pathname = `${basePath}/${uriEncode(bucket)}/${key}`;
  else {
    url.hostname = `${bucket}.${url.hostname}`;
    url.pathname = `${basePath}/${key}`;
  }

  const amzDate = input.now
    .toISOString()
    .replace(/[-:]/gu, "")
    .replace(/\.\d{3}/u, "");
  const dateStamp = amzDate.slice(0, 8);
  const scope = `${dateStamp}/${region}/s3/aws4_request`;
  const query = [
    ["X-Amz-Algorithm", ALGORITHM],
    ["X-Amz-Credential", `${accessKeyId}/${scope}`],
    ["X-Amz-Date", amzDate],
    ["X-Amz-Expires", String(input.expiresSeconds)],
    ["X-Amz-SignedHeaders", "host"],
  ]
    .map(([name = "", value = ""]) => `${uriEncode(name)}=${uriEncode(value)}`)
    .sort()
    .join("&");
  const canonicalRequest = [input.method, url.pathname, query, `host:${url.host}\n`, "host", "UNSIGNED-PAYLOAD"].join(
    "\n",
  );
  const stringToSign = [ALGORITHM, amzDate, scope, toHex(await sha256(canonicalRequest))].join("\n");
  let signingKey = await hmac(encoder.encode(`AWS4${secretAccessKey}`), dateStamp);
  for (const part of [region, "s3", "aws4_request"]) signingKey = await hmac(signingKey, part);
  const signature = toHex(await hmac(signingKey, stringToSign));
  return `${url.origin}${url.pathname}?${query}&X-Amz-Signature=${signature}`;
}

function uriEncode(value: string): string {
  return encodeURIComponent(value).replace(/[!'()*]/gu, (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`);
}

function toHex(bytes: ArrayBuffer): string {
  return [...new Uint8Array(bytes)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function sha256(text: string): Promise<ArrayBuffer> {
  return crypto.subtle.digest("SHA-256", encoder.encode(text));
}

async function hmac(key: Uint8Array<ArrayBuffer> | ArrayBuffer, data: string): Promise<ArrayBuffer> {
  const imported = await crypto.subtle.importKey("raw", key, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return crypto.subtle.sign("HMAC", imported, encoder.encode(data));
}
