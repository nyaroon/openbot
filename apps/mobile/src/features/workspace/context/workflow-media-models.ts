import {
  type AgentModelOption,
  WORKFLOW_CATALOG_PROVIDERS,
  WORKFLOW_MEDIA_MODELS,
  type WorkflowCatalogProvider,
  type WorkflowMediaCatalogModel,
  type WorkflowMediaPriceRequest,
  workflowCatalogMediaModel,
} from "@openbot/contracts/ipc";
import {
  WORKFLOWS_MEDIA_CATALOG_CAPABILITY,
  WORKFLOWS_MEDIA_CATALOG_ROUTES,
} from "@openbot/contracts/team-protocol/workflows-media-catalog-v1";
import {
  WORKFLOWS_MEDIA_CATALOG_V2_CAPABILITY,
  WORKFLOWS_MEDIA_CATALOG_V2_ROUTES,
} from "@openbot/contracts/team-protocol/workflows-media-catalog-v2";
import { WORKFLOWS_MEDIA_CAPABILITY } from "@openbot/contracts/team-protocol/workflows-media-v1";
import { WORKFLOWS_CAPABILITY } from "@openbot/contracts/team-protocol/workflows-v1";
import {
  decodeRemoteWorkflowMediaCatalog,
  decodeRemoteWorkflowMediaPrice,
} from "@openbot/team-client/workflow-decoding";
import type { WorkspaceRequest } from "@/features/workspace/context/host-request-actions";
import {
  hasCapability,
  requireCapability,
  type ServerCapabilities,
} from "@/features/workspace/model/server-capabilities";
import type { WorkflowMediaModels } from "@/features/workspace/model/workspace-types";

const NO_ENTRIES: readonly WorkflowMediaCatalogModel[] = [];

export async function loadWorkflowMediaModels({
  request,
  capabilities,
  loadAgentModels,
  serverId,
}: {
  request: WorkspaceRequest;
  capabilities: ServerCapabilities;
  loadAgentModels: (serverId: string) => Promise<AgentModelOption[]>;
  serverId: string;
}): Promise<WorkflowMediaModels> {
  requireCapability(capabilities, serverId, WORKFLOWS_CAPABILITY, "mobile.workflow.unsupported");
  requireCapability(capabilities, serverId, WORKFLOWS_MEDIA_CAPABILITY, "mobile.workflow.media.unsupported");
  const has = (capability: string) => hasCapability(capabilities, serverId, capability);
  let partial = false;
  const catalog = async (path: string) => {
    try {
      return (await request("POST", path, decodeRemoteWorkflowMediaCatalog, {}, serverId)).models;
    } catch {
      partial = true;
      return NO_ENTRIES;
    }
  };
  const servicePath = has(WORKFLOWS_MEDIA_CATALOG_V2_CAPABILITY)
    ? WORKFLOWS_MEDIA_CATALOG_V2_ROUTES.catalog
    : has(WORKFLOWS_MEDIA_CATALOG_CAPABILITY)
      ? WORKFLOWS_MEDIA_CATALOG_ROUTES.catalog
      : null;
  const [services, agentModels] = await Promise.all([
    servicePath ? catalog(servicePath) : NO_ENTRIES,
    loadAgentModels(serverId).catch((): AgentModelOption[] => {
      partial = true;
      return [];
    }),
  ]);
  const listed = (entries: readonly WorkflowMediaCatalogModel[], source: WorkflowCatalogProvider) =>
    entries.filter((entry) => entry.provider === source).flatMap((entry) => workflowCatalogMediaModel(entry) ?? []);
  const providers = new Set<string>(agentModels.map((model) => model.provider));
  const fixed = WORKFLOW_MEDIA_MODELS.filter(
    (model) => (model.provider === "codex" || model.provider === "grok") && providers.has(model.provider),
  );
  const service = WORKFLOW_CATALOG_PROVIDERS.flatMap((provider) => {
    const live = listed(services, provider);
    if (live.length === 0) return [];
    const ids = new Set(live.map((model) => model.id));
    return [...live, ...WORKFLOW_MEDIA_MODELS.filter((model) => model.provider === provider && !ids.has(model.id))];
  });
  return { models: [...fixed, ...service], partial };
}

export async function loadWorkflowMediaPrice({
  request,
  capabilities,
  serverId,
  input,
}: {
  request: WorkspaceRequest;
  capabilities: ServerCapabilities;
  serverId: string;
  input: WorkflowMediaPriceRequest;
}): Promise<number | null> {
  const has = (capability: string) => hasCapability(capabilities, serverId, capability);
  const path = has(WORKFLOWS_MEDIA_CATALOG_V2_CAPABILITY)
    ? WORKFLOWS_MEDIA_CATALOG_V2_ROUTES.price
    : has(WORKFLOWS_MEDIA_CATALOG_CAPABILITY)
      ? WORKFLOWS_MEDIA_CATALOG_ROUTES.price
      : null;
  if (!path) return null;
  const body = {
    model: input.model,
    kind: input.kind,
    aspect: input.aspect,
    duration: input.duration,
    resolution: input.resolution,
    transparent: input.transparent,
    ...(input.options ? { options: input.options.map((option) => ({ name: option.name, value: option.value })) } : {}),
  };
  return (await request("POST", path, decodeRemoteWorkflowMediaPrice, body, serverId)).credits;
}
