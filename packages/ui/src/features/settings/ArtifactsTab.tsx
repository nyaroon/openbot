import type { OrganizationArtifact } from "@openbot/contracts/ipc";
import {
  Alert,
  AlertDescription,
  Badge,
  Button,
  ConfirmDialog,
  ErrorReference,
  IconButton,
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemTitle,
  SettingsSection,
  Text,
  Trash2,
} from "@openbot/ui";
import { createSignal, For, Show } from "solid-js";
import { useText } from "../../text";
import type { ArtifactsStore } from "./stores/artifacts-store";

interface ArtifactsTabProps {
  store: ArtifactsStore;
}

const UPDATED_FORMAT: Intl.DateTimeFormatOptions = { year: "numeric", month: "numeric", day: "numeric" };

export function ArtifactsTab(props: ArtifactsTabProps) {
  const { t, format } = useText();
  const store = props.store;
  const [pending, setPending] = createSignal<OrganizationArtifact | null>(null);
  return (
    <>
      <Show when={pending() === null && store.state.error}>
        {(error) => (
          <Alert tone="danger" role="alert">
            <AlertDescription>
              {error().message}
              <ErrorReference reference={error().reference} />
            </AlertDescription>
          </Alert>
        )}
      </Show>
      <SettingsSection
        data-settings-row="organization.artifacts.title"
        title={t("organization.artifacts.title")}
        description={t("organization.artifacts.intro")}
      >
        <Show
          when={store.state.artifacts.length > 0}
          fallback={
            <Show when={store.state.loaded}>
              <Text>{t("organization.artifacts.empty")}</Text>
            </Show>
          }
        >
          <ItemGroup class="settings-modal-card">
            <For each={store.state.artifacts}>
              {(artifact) => (
                <Item>
                  <ItemContent>
                    <ItemTitle>{artifact.title}</ItemTitle>
                    <ItemDescription>
                      {t("organization.artifacts.detail", {
                        organization: artifact.organizationName,
                        owner: artifact.ownerName,
                        version: artifact.version,
                        updated: format.date(artifact.updatedAt, UPDATED_FORMAT),
                      })}
                    </ItemDescription>
                  </ItemContent>
                  <ItemActions>
                    <Show when={artifact.visibility === "public"}>
                      <Badge variant="primary-light">{t("organization.artifacts.public")}</Badge>
                    </Show>
                    <Button
                      variant="outline"
                      size="sm"
                      aria-label={t("organization.artifacts.openLabel", { title: artifact.title })}
                      disabled={store.state.busy}
                      onClick={() => void store.open(artifact.id)}
                    >
                      {t("organization.artifacts.open")}
                    </Button>
                    <IconButton
                      label={t("organization.artifacts.delete", { title: artifact.title })}
                      variant="ghost"
                      disabled={store.state.busy}
                      onClick={() => setPending(artifact)}
                    >
                      <Trash2 aria-hidden="true" />
                    </IconButton>
                  </ItemActions>
                </Item>
              )}
            </For>
          </ItemGroup>
        </Show>
        <Button variant="outline" size="sm" disabled={store.state.busy} onClick={() => void store.refresh()}>
          {t("organization.refresh")}
        </Button>
      </SettingsSection>
      <ConfirmDialog
        open={pending() !== null}
        title={t("organization.artifacts.deleteTitle")}
        description={t("organization.artifacts.deleteBody", { title: pending()?.title ?? "" })}
        confirmLabel={t("organization.artifacts.deleteConfirm")}
        pending={store.state.busy}
        error={
          pending() !== null && store.state.error ? (
            <>
              {store.state.error.message}
              <ErrorReference reference={store.state.error.reference} />
            </>
          ) : undefined
        }
        onCancel={() => setPending(null)}
        onConfirm={() => {
          const artifact = pending();
          if (!artifact) return;
          void store.remove(artifact.id).then((removed) => {
            if (removed) setPending(null);
          });
        }}
      />
    </>
  );
}
