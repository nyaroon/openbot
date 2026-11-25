/**
 * The narrow object-storage interface that the Worker uses for avatars, marketplace bundles, share
 * cards, host logos and vault blobs. A Cloudflare `R2Bucket` is structurally assignable to it, and
 * `createS3Bucket` (`s3-object-bucket.ts`) implements it over any S3-compatible service.
 */

export interface ObjectHttpMetadata {
  contentType?: string;
  cacheControl?: string;
}

export interface StoredObjectInfo {
  readonly key: string;
  readonly size: number;
  /** The entity tag without quotes. */
  readonly etag: string;
  /** The entity tag as it goes into an `ETag` header (with quotes). */
  readonly httpEtag: string;
  readonly uploaded: Date;
  readonly httpMetadata?: ObjectHttpMetadata;
  readonly customMetadata?: Record<string, string>;
  writeHttpMetadata(headers: Headers): void;
}

/** An object without its content. A conditional `get` whose condition fails returns this, without a `body` key. */
export interface StoredObject extends StoredObjectInfo {
  readonly body?: undefined;
}

export interface StoredObjectBody extends StoredObjectInfo {
  readonly body: ReadableStream;
  arrayBuffer(): Promise<ArrayBuffer>;
  text(): Promise<string>;
}

export interface ObjectGetOptions {
  /** Request headers (`If-None-Match`, `If-Match`, `If-Modified-Since`, `If-Unmodified-Since`). When one fails, the result has no `body`. */
  onlyIf?: Headers;
}

export interface ObjectPutOptions {
  httpMetadata?: ObjectHttpMetadata;
  customMetadata?: Record<string, string>;
}

export interface ObjectListOptions {
  prefix?: string;
  cursor?: string;
  limit?: number;
  delimiter?: string;
}

export interface ObjectList {
  objects: StoredObject[];
  truncated: boolean;
  cursor?: string;
  delimitedPrefixes: string[];
}

export type ObjectValue = Uint8Array | ArrayBuffer | string;

export interface ObjectBucket {
  get(key: string): Promise<StoredObjectBody | null>;
  get(key: string, options: ObjectGetOptions | undefined): Promise<StoredObject | StoredObjectBody | null>;
  head(key: string): Promise<StoredObject | null>;
  put(key: string, value: ObjectValue, options?: ObjectPutOptions): Promise<unknown>;
  delete(keys: string | string[]): Promise<void>;
  list(options?: ObjectListOptions): Promise<ObjectList>;
}

/** Object storage is used while its configuration is missing. The API answers 503 `storage_not_configured`. */
export class StorageNotConfiguredError extends Error {
  readonly missing: readonly string[];

  constructor(missing: readonly string[]) {
    super(`Object storage is not configured. Missing: ${missing.join(", ")}.`);
    this.name = "StorageNotConfiguredError";
    this.missing = missing;
  }
}

/** A bucket whose every call fails with `StorageNotConfiguredError`, so only the routes that need storage fail. */
export function createUnconfiguredBucket(missing: readonly string[]): ObjectBucket {
  const fail = async (): Promise<never> => {
    throw new StorageNotConfiguredError(missing);
  };
  return { get: fail, head: fail, put: fail, delete: fail, list: fail };
}
