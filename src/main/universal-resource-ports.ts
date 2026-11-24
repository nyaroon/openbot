import type { AgentSummary, McpServerConfig } from "@openbot/contracts/ipc";
import { sourceText } from "@openbot/i18n/source";
import { Effect, Result } from "effect";
import type { McpGatewayChange } from "../backend/agent/mcp-gateway";
import { LocalSkillFailure, type LocalSkillLibrary } from "./local-skill-library";
import type { SkillMarketplaceService } from "./skill-marketplace-service";
import { sha256Hex } from "./universal-resource-model";
import type { McpSyncPort, SkillMarkTarget, SkillSyncPort } from "./universal-resources";

export interface McpServerPortSource {
  listMcpServers(): McpServerConfig[];
  saveMcpServer(input: { config: McpServerConfig }): Effect.Effect<McpServerConfig[], unknown>;
  setMcpServerEnabled(input: { mcpServerId: string; enabled: boolean }): Effect.Effect<McpServerConfig[], unknown>;
  onMcpServerChange(listener: (change: McpGatewayChange) => void): () => void;
}

export function mcpSyncPort(source: McpServerPortSource): McpSyncPort {
  return {
    list: () => source.listMcpServers(),
    save: (config) =>
      source.saveMcpServer({ config }).pipe(
        Effect.flatMap(() => {
          const name = config.name.trim();
          const row = source
            .listMcpServers()
            .find((candidate) => (config.id ? candidate.id === config.id : candidate.name === name));
          return row ? Effect.succeed(row) : Effect.fail(new Error(sourceText("error.backend.mcpServerGone")));
        }),
      ),
    setEnabled: (id, enabled) => source.setMcpServerEnabled({ mcpServerId: id, enabled }),
    onChange: (listener) => source.onMcpServerChange(listener),
  };
}

function isMissingSkill(failure: unknown): boolean {
  return (
    failure instanceof LocalSkillFailure &&
    failure.cause instanceof Error &&
    failure.cause.message === sourceText("error.skill.localNotFound")
  );
}

function unsupported(): Error {
  return new Error(sourceText("error.vault.universalSkillUnsupported"));
}

export function skillSyncPort(
  skills: SkillMarketplaceService,
  library: LocalSkillLibrary,
  agents: () => AgentSummary[],
): SkillSyncPort {
  const latest = (localId: string) =>
    library.get(localId).pipe(
      Effect.flatMap((detail) =>
        library
          .bundle(localId, detail.version)
          .pipe(Effect.map((bytes) => ({ bytes, revision: detail.version, sha256: sha256Hex(bytes) }))),
      ),
      Effect.catch((failure) => (isMissingSkill(failure) ? Effect.succeed(null) : Effect.fail(failure))),
    );

  const target = (localId: string, source: SkillMarkTarget["source"], slug: string, name: string): SkillMarkTarget => ({
    source,
    localId,
    slug,
    name,
  });

  return {
    agentIds: () => agents().map((agent) => agent.id),
    resolve: ({ localId, agentId }) =>
      Effect.gen(function* () {
        if (localId.startsWith("home:")) return yield* Effect.fail(unsupported());
        if (localId.startsWith("local-skill-")) {
          const detail = yield* library.get(localId);
          return target(localId, "bundle", detail.slug, detail.name);
        }
        if (!agentId) return yield* Effect.fail(unsupported());
        const installed = (yield* skills.listInstalled(agentId)).find((skill) => skill.skillId === localId);
        if (!installed || installed.origin === "managed") return yield* Effect.fail(unsupported());
        if (installed.origin === "workspace") {
          if (!installed.location) return yield* Effect.fail(unsupported());
          const existing = (yield* library.list()).find((detail) => detail.slug === installed.slug);
          const detail = existing ?? (yield* library.create(agentId, installed.location));
          return target(detail.id, "bundle", detail.slug, detail.name);
        }
        return target(localId, "marketplace", installed.slug, installed.name);
      }),
    bundle: latest,
    findBySlug: (slug) =>
      library.list().pipe(
        Effect.map((details) => {
          const found = details.find((detail) => detail.slug === slug);
          return found ? { localId: found.id, revision: found.version, sha256: found.bundleSha256 } : null;
        }),
      ),
    importBundle: (existing, bytes) =>
      (existing
        ? library.reviseFromBundle(existing.localId, existing.revision, bytes)
        : library.createFromBundle(bytes)
      ).pipe(Effect.map((detail) => ({ localId: detail.id, revision: detail.version, sha256: detail.bundleSha256 }))),
    withdraw: (localId) =>
      library.revisions(localId).pipe(
        Effect.flatMap((revisions) => Effect.forEach(revisions, (revision) => library.withdraw(localId, revision))),
        Effect.asVoid,
      ),
    install: (source, localId, agentId, revision) =>
      Effect.gen(function* () {
        const installed = yield* skills.installedRevision(agentId, localId);
        if (source === "marketplace") {
          if (installed !== null) return "present" as const;
          const done = yield* Effect.result(skills.install({ agentId, skillId: localId }));
          return Result.isSuccess(done) ? ("installed" as const) : ("conflict" as const);
        }
        if (installed === revision) return "present" as const;
        const done = yield* Effect.result(skills.installLocal({ agentId, skillId: localId, revision }));
        return Result.isSuccess(done) ? ("installed" as const) : ("conflict" as const);
      }),
    uninstall: (agentId, skillId) =>
      Effect.gen(function* () {
        const locked = yield* skills.lockedSkillIds(agentId);
        if (!locked.includes(skillId)) return "absent" as const;
        const done = yield* Effect.result(skills.uninstall({ agentId, skillId }));
        return Result.isSuccess(done) ? ("removed" as const) : ("conflict" as const);
      }),
    onChange: (listener) => library.onChange(listener),
  };
}
