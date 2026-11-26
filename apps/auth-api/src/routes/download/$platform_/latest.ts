import { createFileRoute } from "@tanstack/solid-router";
import { DOWNLOAD_URL } from "../../../lib/landing-links";

// There is no release location of our own yet, so the latest-download links lead to the download page.
export const Route = createFileRoute("/download/$platform_/latest")({
  server: {
    handlers: {
      GET: ({ request }) => Response.redirect(new URL(DOWNLOAD_URL, request.url), 302),
    },
  },
});
