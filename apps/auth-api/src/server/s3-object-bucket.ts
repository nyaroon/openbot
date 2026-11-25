import {
  createUnconfiguredBucket,
  type ObjectBucket,
  type ObjectGetOptions,
  type ObjectHttpMetadata,
  type ObjectList,
  type ObjectListOptions,
  type ObjectPutOptions,
  type ObjectValue,
  type StoredObject,
  type StoredObjectBody,
} from "./object-storage";

/**
 * An `ObjectBucket` over any S3-compatible service (AWS S3, Backblaze B2, MinIO, Wasabi, ...).
 * It signs each request with AWS Signature Version 4 (WebCrypto) and sends it with `fetch`.
 */

const ALGORITHM = "AWS4-HMAC-SHA256";
const EMPTY_PAYLOAD_HASH = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";
const META_PREFIX = "x-amz-meta-";
const REQUEST_TIMEOUT_MS = 30_000;
const DELETE_PARALLELISM = 8;
const CONDITIONAL_HEADERS = ["if-none-match", "if-match", "if-modified-since", "if-unmodified-since"] as const;
const encoder = new TextEncoder();

export interface S3BucketConfig {
  /** The service endpoint, such as `https://s3.us-east-1.amazonaws.com`. */
  endpoint: string;
  /** The signing region. Many S3-compatible services accept `auto` or `us-east-1`. */
  region?: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  /** A key prefix such as `avatars/`. Every key the caller uses is stored below it. */
  prefix?: string;
  /** `true` (default) sends `https://endpoint/bucket/key`; `false` sends `https://bucket.endpoint/key`. */
  forcePathStyle?: boolean;
  fetch?: (input: string, init: RequestInit) => Promise<Response>;
  now?: () => Date;
}

export interface SigV4Request {
  method: string;
  /** The request URL without a query. The path must already be percent-encoded as it goes on the wire. */
  url: URL;
  query?: ReadonlyArray<readonly [string, string]>;
  /** Extra headers to send and sign. `host`, `x-amz-date` and `x-amz-content-sha256` are added. */
  headers?: Readonly<Record<string, string>>;
  payloadHash: string;
  accessKeyId: string;
  secretAccessKey: string;
  region: string;
  service?: string;
  date: Date;
}

export interface SignedSigV4Request {
  /** The headers to send, including `authorization`. `host` is left out because `fetch` sets it. */
  headers: Record<string, string>;
  /** The canonical query string. Use it as the URL query. */
  search: string;
  signature: string;
  canonicalRequest: string;
  stringToSign: string;
}

export async function signSigV4(request: SigV4Request): Promise<SignedSigV4Request> {
  const service = request.service ?? "s3";
  const amzDate = request.date
    .toISOString()
    .replace(/[-:]/gu, "")
    .replace(/\.\d{3}/u, "");
  const dateStamp = amzDate.slice(0, 8);
  const scope = `${dateStamp}/${request.region}/${service}/aws4_request`;
  const signedValues = new Map<string, string>();
  for (const [name, value] of Object.entries(request.headers ?? {})) {
    signedValues.set(name.toLowerCase(), value.trim().replace(/\s+/gu, " "));
  }
  signedValues.set("host", request.url.host);
  signedValues.set("x-amz-content-sha256", request.payloadHash);
  signedValues.set("x-amz-date", amzDate);
  const names = [...signedValues.keys()].sort();
  const canonicalHeaders = names.map((name) => `${name}:${signedValues.get(name)}\n`).join("");
  const signedHeaders = names.join(";");
  const search = canonicalQuery(request.query ?? []);
  const canonicalRequest = [
    request.method,
    request.url.pathname,
    search,
    canonicalHeaders,
    signedHeaders,
    request.payloadHash,
  ].join("\n");
  const stringToSign = [ALGORITHM, amzDate, scope, await sha256Hex(encoder.encode(canonicalRequest))].join("\n");
  let key = await hmac(encoder.encode(`AWS4${request.secretAccessKey}`), dateStamp);
  for (const part of [request.region, service, "aws4_request"]) key = await hmac(key, part);
  const signature = toHex(await hmac(key, stringToSign));
  const headers: Record<string, string> = {};
  for (const name of names) {
    if (name !== "host") headers[name] = signedValues.get(name) ?? "";
  }
  headers.authorization = `${ALGORITHM} Credential=${request.accessKeyId}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;
  return { headers, search, signature, canonicalRequest, stringToSign };
}

export function createS3Bucket(config: S3BucketConfig): ObjectBucket {
  return new S3ObjectBucket(config);
}

class S3ObjectBucket implements ObjectBucket {
  readonly #endpoint: URL;
  readonly #basePath: string;
  readonly #region: string;
  readonly #bucket: string;
  readonly #accessKeyId: string;
  readonly #secretAccessKey: string;
  readonly #prefix: string;
  readonly #pathStyle: boolean;
  readonly #fetch: (input: string, init: RequestInit) => Promise<Response>;
  readonly #now: () => Date;

  constructor(config: S3BucketConfig) {
    this.#endpoint = new URL(config.endpoint);
    this.#basePath = this.#endpoint.pathname.replace(/\/+$/u, "");
    this.#region = config.region?.trim() || "auto";
    this.#bucket = config.bucket;
    this.#accessKeyId = config.accessKeyId;
    this.#secretAccessKey = config.secretAccessKey;
    const prefix = (config.prefix ?? "").replace(/^\/+/u, "");
    this.#prefix = prefix && !prefix.endsWith("/") ? `${prefix}/` : prefix;
    this.#pathStyle = config.forcePathStyle ?? true;
    this.#fetch = config.fetch ?? ((input, init) => fetch(input, init));
    this.#now = config.now ?? (() => new Date());
  }

  get(key: string): Promise<StoredObjectBody | null>;
  get(key: string, options: ObjectGetOptions | undefined): Promise<StoredObject | StoredObjectBody | null>;
  async get(key: string, options?: ObjectGetOptions): Promise<StoredObject | StoredObjectBody | null> {
    const headers: Record<string, string> = {};
    for (const name of CONDITIONAL_HEADERS) {
      const value = options?.onlyIf?.get(name);
      if (value) headers[name] = value;
    }
    const response = await this.#send("GET", key, { headers });
    if (response.status === 404) {
      const text = await response.text().catch(() => "");
      if (xmlText(text, "Code") === "NoSuchBucket") throw this.#failure("GET", response.status, text);
      return null;
    }
    if (response.status === 304 || response.status === 412) {
      await response.body?.cancel();
      return describeObject(key, response);
    }
    if (!response.ok) throw this.#failure("GET", response.status, await response.text().catch(() => ""));
    const stream = response.body ?? emptyStream();
    return {
      ...describeObject(key, response),
      body: stream,
      arrayBuffer: () => response.arrayBuffer(),
      text: () => response.text(),
    };
  }

  async head(key: string): Promise<StoredObject | null> {
    const response = await this.#send("HEAD", key, {});
    if (response.status === 404) return null;
    if (!response.ok) throw this.#failure("HEAD", response.status, "");
    return describeObject(key, response);
  }

  async put(key: string, value: ObjectValue, options?: ObjectPutOptions): Promise<void> {
    const bytes = typeof value === "string" ? encoder.encode(value) : new Uint8Array(value);
    const headers: Record<string, string> = {};
    if (options?.httpMetadata?.contentType) headers["content-type"] = options.httpMetadata.contentType;
    if (options?.httpMetadata?.cacheControl) headers["cache-control"] = options.httpMetadata.cacheControl;
    for (const [name, metadataValue] of Object.entries(options?.customMetadata ?? {})) {
      if (!/^[A-Za-z0-9._-]+$/u.test(name)) throw new Error("Invalid object metadata name.");
      headers[`${META_PREFIX}${name.toLowerCase()}`] = encodeMetadataValue(metadataValue);
    }
    const response = await this.#send("PUT", key, { headers, body: bytes, payloadHash: await sha256Hex(bytes) });
    if (!response.ok) throw this.#failure("PUT", response.status, await response.text().catch(() => ""));
    await response.body?.cancel();
  }

  async delete(keys: string | string[]): Promise<void> {
    const list = typeof keys === "string" ? [keys] : keys;
    for (let start = 0; start < list.length; start += DELETE_PARALLELISM) {
      await Promise.all(list.slice(start, start + DELETE_PARALLELISM).map((key) => this.#deleteOne(key)));
    }
  }

  async list(options?: ObjectListOptions): Promise<ObjectList> {
    const query: Array<readonly [string, string]> = [["list-type", "2"]];
    query.push(["prefix", `${this.#prefix}${options?.prefix ?? ""}`]);
    if (options?.delimiter) query.push(["delimiter", options.delimiter]);
    if (options?.limit !== undefined) query.push(["max-keys", String(Math.max(1, Math.min(1000, options.limit)))]);
    if (options?.cursor) query.push(["continuation-token", options.cursor]);
    const response = await this.#send("GET", null, { query });
    const xml = await response.text().catch(() => "");
    if (!response.ok) throw this.#failure("LIST", response.status, xml);
    const withoutPrefixes = xml.replace(/<CommonPrefixes>[\s\S]*?<\/CommonPrefixes>/gu, "");
    const objects: StoredObject[] = [];
    for (const block of xmlBlocks(withoutPrefixes, "Contents")) {
      const fullKey = xmlText(block, "Key");
      if (fullKey === undefined || !fullKey.startsWith(this.#prefix)) continue;
      const key = fullKey.slice(this.#prefix.length);
      const etag = unquote(xmlText(block, "ETag") ?? "");
      objects.push(
        buildObject({
          key,
          size: Number(xmlText(block, "Size") ?? 0) || 0,
          etag,
          httpEtag: etag ? `"${etag}"` : "",
          uploaded: parseDate(xmlText(block, "LastModified")),
        }),
      );
    }
    const delimitedPrefixes: string[] = [];
    for (const block of xmlBlocks(xml, "CommonPrefixes")) {
      const full = xmlText(block, "Prefix");
      if (full?.startsWith(this.#prefix)) delimitedPrefixes.push(full.slice(this.#prefix.length));
    }
    const truncated = xmlText(withoutPrefixes, "IsTruncated") === "true";
    const cursor = xmlText(withoutPrefixes, "NextContinuationToken");
    if (truncated && !cursor) throw new Error("Object storage list is truncated without a continuation token.");
    return { objects, truncated, delimitedPrefixes, ...(truncated && cursor ? { cursor } : {}) };
  }

  async #deleteOne(key: string): Promise<void> {
    const response = await this.#send("DELETE", key, {});
    if (response.status === 404) {
      await response.body?.cancel();
      return;
    }
    if (!response.ok) throw this.#failure("DELETE", response.status, await response.text().catch(() => ""));
    await response.body?.cancel();
  }

  #url(key: string | null): URL {
    if (key !== null) assertSafeKey(key);
    const objectPath = key === null ? "" : encodePath(`${this.#prefix}${key}`);
    if (this.#pathStyle) {
      const url = new URL(this.#endpoint.origin);
      url.pathname = `${this.#basePath}/${encodeURIComponent(this.#bucket)}${objectPath ? `/${objectPath}` : ""}`;
      return url;
    }
    const url = new URL(this.#endpoint.origin);
    url.hostname = `${this.#bucket}.${this.#endpoint.hostname}`;
    url.pathname = `${this.#basePath}/${objectPath}`;
    return url;
  }

  async #send(
    method: string,
    key: string | null,
    request: {
      headers?: Record<string, string>;
      query?: ReadonlyArray<readonly [string, string]>;
      body?: Uint8Array<ArrayBuffer>;
      payloadHash?: string;
    },
  ): Promise<Response> {
    const url = this.#url(key);
    const signed = await signSigV4({
      method,
      url,
      ...(request.query ? { query: request.query } : {}),
      ...(request.headers ? { headers: request.headers } : {}),
      payloadHash: request.payloadHash ?? EMPTY_PAYLOAD_HASH,
      accessKeyId: this.#accessKeyId,
      secretAccessKey: this.#secretAccessKey,
      region: this.#region,
      date: this.#now(),
    });
    url.search = signed.search;
    try {
      return await this.#fetch(url.toString(), {
        method,
        headers: signed.headers,
        ...(request.body ? { body: request.body } : {}),
        redirect: "manual",
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    } catch (error) {
      throw new Error(`Object storage ${method} request failed (${error instanceof Error ? error.name : "error"}).`);
    }
  }

  #failure(method: string, status: number, body: string): Error {
    const code = xmlText(body, "Code");
    const detail = (xmlText(body, "Message") ?? body.replace(/<[^>]*>/gu, " ")).replace(/\s+/gu, " ").trim();
    const safe = [this.#accessKeyId, this.#secretAccessKey]
      .filter((secret) => secret.length > 0)
      .reduce((text, secret) => text.replaceAll(secret, "[redacted]"), detail.slice(0, 200));
    return new Error(
      `Object storage ${method} failed with status ${status}${code ? ` (${code})` : ""}${safe ? `: ${safe}` : ""}`,
    );
  }
}

export interface ObjectStorageEnv {
  STORAGE_S3_ENDPOINT?: string;
  STORAGE_S3_REGION?: string;
  STORAGE_S3_BUCKET?: string;
  STORAGE_S3_FORCE_PATH_STYLE?: string;
  STORAGE_S3_ACCESS_KEY_ID?: string;
  STORAGE_S3_SECRET_ACCESS_KEY?: string;
}

/** The two logical buckets, stored below the `avatars/` and `skills/` prefixes of one S3 bucket. */
export function resolveObjectStorage(env: ObjectStorageEnv): { AVATARS: ObjectBucket; SKILLS: ObjectBucket } {
  const endpoint = env.STORAGE_S3_ENDPOINT?.trim() ?? "";
  const bucket = env.STORAGE_S3_BUCKET?.trim() ?? "";
  const accessKeyId = env.STORAGE_S3_ACCESS_KEY_ID?.trim() ?? "";
  const secretAccessKey = env.STORAGE_S3_SECRET_ACCESS_KEY?.trim() ?? "";
  const missing = [
    ["STORAGE_S3_ENDPOINT", endpoint],
    ["STORAGE_S3_BUCKET", bucket],
    ["STORAGE_S3_ACCESS_KEY_ID", accessKeyId],
    ["STORAGE_S3_SECRET_ACCESS_KEY", secretAccessKey],
  ]
    .filter(([, value]) => !value)
    .map(([name]) => name ?? "");
  if (endpoint && !URL.canParse(endpoint)) missing.push("STORAGE_S3_ENDPOINT (invalid URL)");
  if (missing.length > 0) {
    const unconfigured = createUnconfiguredBucket(missing);
    return { AVATARS: unconfigured, SKILLS: unconfigured };
  }
  const shared = {
    endpoint,
    bucket,
    accessKeyId,
    secretAccessKey,
    region: env.STORAGE_S3_REGION?.trim() || "auto",
    forcePathStyle: !["false", "0", "no"].includes(env.STORAGE_S3_FORCE_PATH_STYLE?.trim().toLowerCase() ?? ""),
  };
  return {
    AVATARS: createS3Bucket({ ...shared, prefix: "avatars/" }),
    SKILLS: createS3Bucket({ ...shared, prefix: "skills/" }),
  };
}

interface ObjectFields {
  key: string;
  size: number;
  etag: string;
  httpEtag: string;
  uploaded: Date;
  httpMetadata?: ObjectHttpMetadata;
  customMetadata?: Record<string, string>;
}

function buildObject(fields: ObjectFields): StoredObject {
  return {
    ...fields,
    writeHttpMetadata(headers) {
      if (fields.httpMetadata?.contentType) headers.set("Content-Type", fields.httpMetadata.contentType);
      if (fields.httpMetadata?.cacheControl) headers.set("Cache-Control", fields.httpMetadata.cacheControl);
    },
  };
}

function describeObject(key: string, response: Response): StoredObject {
  const raw = response.headers.get("etag") ?? "";
  const etag = unquote(raw);
  const contentType = response.headers.get("content-type");
  const cacheControl = response.headers.get("cache-control");
  const customMetadata: Record<string, string> = {};
  for (const [name, value] of response.headers) {
    if (name.toLowerCase().startsWith(META_PREFIX)) {
      customMetadata[name.slice(META_PREFIX.length).toLowerCase()] = decodeMetadataValue(value);
    }
  }
  return buildObject({
    key,
    size: Number(response.headers.get("content-length") ?? 0) || 0,
    etag,
    httpEtag: raw.startsWith("W/") ? raw : etag ? `"${etag}"` : "",
    uploaded: parseDate(response.headers.get("last-modified") ?? undefined),
    httpMetadata: {
      ...(contentType ? { contentType } : {}),
      ...(cacheControl ? { cacheControl } : {}),
    },
    customMetadata,
  });
}

function emptyStream(): ReadableStream {
  return new ReadableStream({
    start(controller) {
      controller.close();
    },
  });
}

function parseDate(value: string | undefined): Date {
  const date = value ? new Date(value) : new Date(0);
  return Number.isNaN(date.getTime()) ? new Date(0) : date;
}

function unquote(etag: string): string {
  return etag.replace(/^W\//u, "").replace(/^"(.*)"$/u, "$1");
}

function assertSafeKey(key: string): void {
  if (key.length === 0 || key.split("/").some((segment) => segment === "." || segment === "..")) {
    throw new Error("Invalid object key.");
  }
}

function uriEncode(value: string): string {
  return encodeURIComponent(value).replace(/[!'()*]/gu, (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`);
}

function encodePath(path: string): string {
  return path.split("/").map(uriEncode).join("/");
}

function canonicalQuery(query: ReadonlyArray<readonly [string, string]>): string {
  return query
    .map(([name, value]) => [uriEncode(name), uriEncode(value)] as const)
    .sort(([a, av], [b, bv]) => (a < b ? -1 : a > b ? 1 : av < bv ? -1 : av > bv ? 1 : 0))
    .map(([name, value]) => `${name}=${value}`)
    .join("&");
}

function encodeMetadataValue(value: string): string {
  return value.replace(/[^\x21-\x7e]|%/gu, (char) => encodeURIComponent(char));
}

function decodeMetadataValue(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function decodeXml(value: string): string {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/gu, "$1")
    .replace(/&(#x[0-9a-fA-F]+|#\d+|amp|lt|gt|quot|apos);/gu, (match, entity: string) => {
      if (entity === "amp") return "&";
      if (entity === "lt") return "<";
      if (entity === "gt") return ">";
      if (entity === "quot") return '"';
      if (entity === "apos") return "'";
      const code = entity.startsWith("#x")
        ? Number.parseInt(entity.slice(2), 16)
        : Number.parseInt(entity.slice(1), 10);
      return Number.isInteger(code) && code >= 0 && code <= 0x10ffff ? String.fromCodePoint(code) : match;
    });
}

function xmlBlocks(xml: string, tag: string): string[] {
  return [...xml.matchAll(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`, "gu"))].map(
    (match) => match[1] ?? "",
  );
}

function xmlText(xml: string, tag: string): string | undefined {
  const [block] = xmlBlocks(xml, tag);
  if (block !== undefined) return decodeXml(block);
  return new RegExp(`<${tag}\\s*/>`, "u").test(xml) ? "" : undefined;
}

function toHex(bytes: ArrayBuffer): string {
  return [...new Uint8Array(bytes)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function sha256Hex(data: Uint8Array<ArrayBuffer>): Promise<string> {
  return toHex(await crypto.subtle.digest("SHA-256", data));
}

async function hmac(key: Uint8Array<ArrayBuffer> | ArrayBuffer, data: string): Promise<ArrayBuffer> {
  const imported = await crypto.subtle.importKey("raw", key, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return crypto.subtle.sign("HMAC", imported, encoder.encode(data));
}
