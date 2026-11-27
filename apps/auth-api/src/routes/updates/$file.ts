import { createFileRoute } from "@tanstack/solid-router";
import { requestUpdateFile } from "../../server/request-auth";

/** The update feed of the desktop app: the feed file and the installers of the newest release. */
export const Route = createFileRoute("/updates/$file")({
  server: {
    handlers: {
      GET: ({ params }) => requestUpdateFile(params.file, "GET"),
      HEAD: ({ params }) => requestUpdateFile(params.file, "HEAD"),
    },
  },
});
