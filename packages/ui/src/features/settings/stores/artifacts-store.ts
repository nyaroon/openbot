import type { OrganizationArtifact, OrganizationsDesktopApi } from "@openbot/contracts/ipc";
import type { UserErrorDetails } from "@openbot/user-errors";
import { createStore } from "solid-js";
import { currentText } from "../../../text";

export interface ArtifactsStoreProps {
  api: () => Pick<OrganizationsDesktopApi, "artifacts" | "removeArtifact" | "openArtifact">;
}

interface ArtifactsPanel {
  artifacts: OrganizationArtifact[];
  loaded: boolean;
  busy: boolean;
  error: UserErrorDetails | null;
}

export function createArtifactsStore(props: ArtifactsStoreProps) {
  const [state, setState] = createStore<ArtifactsPanel>({ artifacts: [], loaded: false, busy: false, error: null });

  async function guarded(action: () => Promise<void>): Promise<boolean> {
    setState((draft) => {
      draft.busy = true;
      draft.error = null;
    });
    try {
      await action();
      return true;
    } catch (error) {
      const { errorDetails, t } = currentText();
      setState((draft) => {
        draft.error = errorDetails(error, t("organization.artifacts.failed"));
      });
      return false;
    } finally {
      setState((draft) => {
        draft.busy = false;
      });
    }
  }

  const show = (artifacts: OrganizationArtifact[]) => {
    setState((draft) => {
      draft.artifacts = artifacts;
      draft.loaded = true;
    });
  };

  return {
    state,
    refresh: () => guarded(async () => show(await props.api().artifacts())),
    remove: (artifactId: string) => guarded(async () => show(await props.api().removeArtifact({ artifactId }))),
    open: (artifactId: string) => guarded(() => props.api().openArtifact({ artifactId })),
  };
}

export type ArtifactsStore = ReturnType<typeof createArtifactsStore>;
