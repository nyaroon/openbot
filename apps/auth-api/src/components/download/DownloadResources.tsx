import { Link } from "@tanstack/solid-router";

export function DownloadResources() {
  return (
    <p class="download-resources">
      <Link to="/changelog">Release notes</Link>
    </p>
  );
}
