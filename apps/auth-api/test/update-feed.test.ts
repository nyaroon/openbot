import { describe, expect, it } from "vitest";
import { isUpdateFile, isUpdateManifest, updateFileLink } from "../src/server/update-feed";

const env = {
  STORAGE_S3_ENDPOINT: "https://storage.example.test",
  STORAGE_S3_BUCKET: "bucket",
  STORAGE_S3_ACCESS_KEY_ID: "key-id",
  STORAGE_S3_SECRET_ACCESS_KEY: "secret-key",
  STORAGE_S3_REGION: "auto",
};
const now = new Date("2026-11-27T06:00:00.000Z");

describe("update feed", () => {
  it("accepts release files only", () => {
    expect(isUpdateFile("latest.yml")).toBe(true);
    expect(isUpdateFile("Jujurly-0.78.1-x64.exe")).toBe(true);
    expect(isUpdateFile("Jujurly-0.78.1-x64.exe.blockmap")).toBe(true);
    expect(isUpdateFile("../avatars/a.exe")).toBe(false);
    expect(isUpdateFile("a..exe")).toBe(false);
    expect(isUpdateFile("page.html")).toBe(false);
    expect(isUpdateFile("")).toBe(false);
    expect(isUpdateManifest("latest.yml")).toBe(true);
    expect(isUpdateManifest("Jujurly-0.78.1-x64.exe")).toBe(false);
  });

  it("signs a link below the updates prefix that expires", async () => {
    const link = await updateFileLink({ env, method: "GET", file: "latest.yml", expiresSeconds: 600, now });
    const url = new URL(link ?? "");
    expect(url.origin + url.pathname).toBe("https://storage.example.test/bucket/updates/latest.yml");
    expect(url.searchParams.get("X-Amz-Expires")).toBe("600");
    expect(url.searchParams.get("X-Amz-Date")).toBe("20261127T060000Z");
    expect(url.searchParams.get("X-Amz-Credential")).toBe("key-id/20261127/auto/s3/aws4_request");
    expect(url.searchParams.get("X-Amz-Signature")).toMatch(/^[0-9a-f]{64}$/u);
    expect(link).not.toContain("secret-key");
  });

  it("signs reading and writing differently", async () => {
    const read = await updateFileLink({ env, method: "GET", file: "latest.yml", expiresSeconds: 600, now });
    const write = await updateFileLink({ env, method: "PUT", file: "latest.yml", expiresSeconds: 600, now });
    expect(read).not.toBe(write);
  });

  it("gives no link for another file or without storage", async () => {
    expect(await updateFileLink({ env, method: "PUT", file: "../x.exe", expiresSeconds: 600, now })).toBeNull();
    expect(await updateFileLink({ env: {}, method: "GET", file: "latest.yml", expiresSeconds: 600, now })).toBeNull();
  });
});
