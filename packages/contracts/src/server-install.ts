import { INPUT_LIMITS } from "./input-limits";
import type { ConversationMessage } from "./ipc-conversation-messages";
import { isDynamicRecord, isNumber, isString } from "./runtime-values";
import { slugifyTeamServerName } from "./validation";

export function parseServerName(value: string): string | null {
  const name = value.trim();
  if (name.length < INPUT_LIMITS.serverNameMin || name.length > INPUT_LIMITS.serverName || /\p{Cc}/u.test(name)) {
    return null;
  }
  return slugifyTeamServerName(name).length >= INPUT_LIMITS.serverNameMin ? name : null;
}

export interface ServerClaim {
  claim: string;
  expiresAt: number;
}

const SERVER_CLAIM_PATTERN = /^[A-Za-z0-9_-]{16,128}$/;

export function parseServerClaim(value: unknown): ServerClaim | null {
  if (!isDynamicRecord(value) || !isString(value.claim) || !SERVER_CLAIM_PATTERN.test(value.claim)) return null;
  if (!isNumber(value.expiresAt) || !Number.isFinite(value.expiresAt)) return null;
  return { claim: value.claim, expiresAt: value.expiresAt };
}

export const INSTALL_SERVER_SCRIPT_URL =
  "https://raw.githubusercontent.com/nightly-labs/openbot/main/scripts/install-server.sh";

function shellWord(value: string): string {
  return `'${value.replaceAll("'", "'\\''")}'`;
}

export function installServerCommand(claim: string, name?: string): string {
  const named = name === undefined ? "" : ` -- --name ${shellWord(name)}`;
  return `{ echo OPENBOT_CLAIM=${claim}; curl -fsSL ${INSTALL_SERVER_SCRIPT_URL}; } | sudo bash -s${named}`;
}

const SERVER_INSTALL_ITEM_TYPE_PREFIX = "server-install:";
const ITEM_TYPE_LIMIT = 128;

export interface ServerInstallEvent {
  expiresAt: number;
  name: string | null;
}

export function serverInstallItemType(event: ServerInstallEvent): string {
  if (!Number.isSafeInteger(event.expiresAt) || event.expiresAt < 0) throw new Error("A valid expiry is required.");
  const base = `${SERVER_INSTALL_ITEM_TYPE_PREFIX}${event.expiresAt}:`;
  const named = event.name === null ? base : `${base}${encodeURIComponent(event.name)}`;
  return named.length <= ITEM_TYPE_LIMIT ? named : base;
}

export function serverInstallEvent(message: ConversationMessage): ServerInstallEvent | null {
  if (message.author !== "system" || message.source !== "system" || message.status !== "completed") return null;
  if (!message.itemType?.startsWith(SERVER_INSTALL_ITEM_TYPE_PREFIX)) return null;
  const match = /^([0-9]{1,16}):(.*)$/su.exec(message.itemType.slice(SERVER_INSTALL_ITEM_TYPE_PREFIX.length));
  if (!match?.[1] || match[2] === undefined) return null;
  const expiresAt = Number(match[1]);
  if (!Number.isSafeInteger(expiresAt)) return null;
  if (!match[2]) return { expiresAt, name: null };
  try {
    return { expiresAt, name: parseServerName(decodeURIComponent(match[2])) };
  } catch {
    return null;
  }
}
