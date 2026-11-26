import { createFileRoute, redirect } from "@tanstack/solid-router";

// The platform pages list installers that do not exist yet, so they all lead to the page that says so.
export const Route = createFileRoute("/download/$platform")({
  beforeLoad: () => {
    throw redirect({ to: "/download" });
  },
});
