import { isDynamicRecord, isNumber, isString } from "@openbot/contracts/runtime-values";
import { Effect } from "effect";
import {
  type ArtifactDetail,
  type ArtifactOperations,
  ArtifactRefusal,
  type ArtifactSummary,
} from "../backend/agent/artifact-tool";
import type { CentralAuthOperationError } from "./central-auth-effects";
import { authApiErrorCode, type CentralAuthManager } from "./central-auth-manager";

const REQUEST_TIMEOUT_MS = 30_000;

function invalid(): never {
  throw new Error("The account service sent an artifact that cannot be read.");
}

function decodeSummary(value: unknown): ArtifactSummary {
  if (
    !isDynamicRecord(value) ||
    !isString(value.id) ||
    !isString(value.url) ||
    !isString(value.title) ||
    !isNumber(value.version) ||
    !isString(value.organizationName) ||
    !isString(value.ownerName) ||
    !isNumber(value.updatedAt)
  )
    return invalid();
  return {
    id: value.id,
    url: value.url,
    title: value.title,
    version: value.version,
    visibility: value.visibility === "public" ? "public" : "organization",
    organizationName: value.organizationName,
    ownerName: value.ownerName,
    updatedAt: value.updatedAt,
  };
}

function decodePublished(value: unknown): ArtifactSummary {
  return isDynamicRecord(value) ? decodeSummary(value.artifact) : invalid();
}

function decodeList(value: unknown): ArtifactSummary[] {
  return isDynamicRecord(value) && Array.isArray(value.artifacts) ? value.artifacts.map(decodeSummary) : invalid();
}

function decodeDetail(value: unknown): ArtifactDetail {
  if (!isDynamicRecord(value) || !isString(value.html)) return invalid();
  const versions: ArtifactDetail["versions"] = [];
  for (const item of Array.isArray(value.versions) ? value.versions : []) {
    if (isDynamicRecord(item) && isNumber(item.version) && isNumber(item.bytes) && isNumber(item.createdAt)) {
      versions.push({ version: item.version, bytes: item.bytes, createdAt: item.createdAt });
    }
  }
  const comments: ArtifactDetail["comments"] = [];
  for (const item of Array.isArray(value.comments) ? value.comments : []) {
    if (isDynamicRecord(item) && isString(item.author) && isString(item.body) && isNumber(item.createdAt)) {
      comments.push({ author: item.author, body: item.body, createdAt: item.createdAt });
    }
  }
  return { artifact: decodeSummary(value.artifact), html: value.html, versions, comments };
}

function decodeIgnored(_value: unknown): null {
  return null;
}

function refusal(failure: CentralAuthOperationError): ArtifactRefusal {
  const code = authApiErrorCode(failure.cause);
  if (code === null) return new ArtifactRefusal("The account service did not answer. Try again later.");
  if (code === "unauthorized") return new ArtifactRefusal("The user must sign in to the app first.");
  return new ArtifactRefusal(failure.cause instanceof Error ? failure.cause.message : code);
}

/** Lets agents publish artifacts through the account service, as the signed-in account. */
export function createArtifactClient(auth: Pick<CentralAuthManager, "requestAuthorized">): ArtifactOperations {
  const call = <T>(path: string, method: "GET" | "POST" | "DELETE", body: unknown, decode: (value: unknown) => T) => {
    const init: RequestInit =
      body === undefined
        ? { method }
        : { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) };
    return auth.requestAuthorized(path, init, decode, REQUEST_TIMEOUT_MS).pipe(Effect.mapError(refusal));
  };
  const path = (artifactId: string) => `/v1/artifacts/${encodeURIComponent(artifactId)}`;
  return {
    publish: (input) => call("/v1/artifacts", "POST", input, decodePublished),
    list: () => call("/v1/artifacts", "GET", undefined, decodeList),
    read: (artifactId) => call(path(artifactId), "GET", undefined, decodeDetail),
    remove: (artifactId) => call(path(artifactId), "DELETE", undefined, decodeIgnored).pipe(Effect.asVoid),
  };
}
