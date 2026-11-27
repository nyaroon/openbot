import type { ArtifactPage, ArtifactView } from "./artifacts";

/**
 * The frame that shows an artifact. Scripts and forms run, but the page gets an opaque origin: it
 * has no cookie of this site and cannot call its API, open windows or move the tab.
 */
export const ARTIFACT_FRAME_SANDBOX = "allow-scripts allow-forms";

const PAGE_HEADERS = {
  "Content-Type": "text/html; charset=utf-8",
  "Cache-Control": "private, no-store",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "X-Robots-Tag": "noindex, nofollow",
};

const STYLE = `
:root { color-scheme: light dark; --line: color-mix(in srgb, currentColor 16%, transparent);
  --soft: color-mix(in srgb, currentColor 62%, transparent); --fill: color-mix(in srgb, currentColor 6%, transparent); }
* { box-sizing: border-box; }
body { margin: 0; font: 14px/1.5 system-ui, -apple-system, "Segoe UI", sans-serif; background: Canvas; color: CanvasText; }
a { color: inherit; }
header { display: flex; flex-wrap: wrap; align-items: center; gap: 4px 12px; min-height: 48px; padding: 8px 16px;
  border-bottom: 1px solid var(--line); }
header h1 { margin: 0; font-size: 15px; font-weight: 600; overflow-wrap: anywhere; }
header .brand { font-weight: 600; text-decoration: none; }
.meta { color: var(--soft); font-size: 12px; }
.badge { padding: 1px 8px; border: 1px solid var(--line); border-radius: 999px; font-size: 12px; }
.spacer { flex: 1; }
iframe { display: block; width: 100%; height: calc(100vh - 49px); min-height: 320px; border: 0; background: #fff; }
main { max-width: 760px; margin: 0 auto; padding: 16px; }
section { margin: 0 0 24px; }
h2 { margin: 0 0 8px; font-size: 14px; }
ul { margin: 0; padding: 0; list-style: none; }
li { padding: 8px 0; border-bottom: 1px solid var(--line); overflow-wrap: anywhere; }
li p { margin: 2px 0 0; white-space: pre-wrap; }
textarea { width: 100%; min-height: 72px; padding: 8px; border: 1px solid var(--line); border-radius: 8px;
  background: var(--fill); color: inherit; font: inherit; resize: vertical; }
button, .button { display: inline-block; padding: 6px 12px; border: 1px solid var(--line); border-radius: 8px;
  background: var(--fill); color: inherit; font: inherit; text-decoration: none; cursor: pointer; }
form { margin: 8px 0 0; }
.row { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
.notice { max-width: 420px; margin: 18vh auto 0; padding: 16px; text-align: center; }
`;

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function day(time: number): string {
  return `${new Date(time).toISOString().slice(0, 16).replace("T", " ")} UTC`;
}

function document(title: string, body: string, status = 200): Response {
  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>${escapeHtml(title)}</title>
<style>${STYLE}</style>
</head>
<body>
${body}
</body>
</html>`;
  return new Response(html, { status, headers: PAGE_HEADERS });
}

/** A short page for "sign in first" and "not found". It never says whether a private artifact exists. */
export function artifactNoticePage(input: { status: 401 | 403 | 404 | 503; title: string; text: string }): Response {
  return document(
    input.title,
    `<div class="notice">
<h1>${escapeHtml(input.title)}</h1>
<p class="meta">${escapeHtml(input.text)}</p>
<p><a class="button" href="/app">Open Jujurly</a></p>
</div>`,
    input.status,
  );
}

export function artifactListPage(artifacts: ArtifactView[]): Response {
  const items = artifacts
    .map(
      (item) => `<li>
<a href="/a/${item.id}"><strong>${escapeHtml(item.title)}</strong></a>
<span class="badge">${item.visibility === "public" ? "Public link" : "Organization"}</span>
<div class="meta">${escapeHtml(item.organizationName)} · ${escapeHtml(item.ownerName)} · version ${item.version} · ${day(item.updatedAt)}</div>
</li>`,
    )
    .join("\n");
  return document(
    "Artifacts",
    `<header><a class="brand" href="/app">Jujurly</a><h1>Artifacts</h1></header>
<main><section>
${artifacts.length > 0 ? `<ul>${items}</ul>` : '<p class="meta">No artifacts yet. Ask an agent to publish one.</p>'}
</section></main>`,
  );
}

function manageSection(page: ArtifactPage): string {
  if (!page.canManage) return "";
  const { artifact } = page;
  const isPublic = artifact.visibility === "public";
  return `<section>
<h2>Manage</h2>
<p class="meta">${
    isPublic
      ? "Anyone who has the link can open this page without signing in."
      : "Only members of the organization can open this page."
  }</p>
<div class="row">
<form method="post"><input type="hidden" name="action" value="visibility">
<input type="hidden" name="visibility" value="${isPublic ? "organization" : "public"}">
<button type="submit">${isPublic ? "Make it organization only" : "Make the link public"}</button></form>
<form method="post"><input type="hidden" name="action" value="delete">
<label class="meta"><input type="checkbox" name="confirm" value="yes" required> Delete every version</label>
<button type="submit">Delete artifact</button></form>
</div>
</section>`;
}

function memberSections(page: ArtifactPage): string {
  if (!page.member) return "";
  const { artifact } = page;
  const versions = page.versions
    .map((item) => {
      const label = `Version ${item.version}${item.version === artifact.version ? " (latest)" : ""}`;
      const href = item.version === artifact.version ? `/a/${artifact.id}` : `/a/${artifact.id}?v=${item.version}`;
      const name = item.version === page.shownVersion ? `<strong>${label}</strong>` : `<a href="${href}">${label}</a>`;
      return `<li>${name} <span class="meta">${day(item.createdAt)} · ${Math.ceil(item.bytes / 1024)} KB</span></li>`;
    })
    .join("\n");
  const comments = page.comments
    .map(
      (item) =>
        `<li><strong>${escapeHtml(item.author)}</strong> <span class="meta">${day(item.createdAt)}</span><p>${escapeHtml(item.body)}</p></li>`,
    )
    .join("\n");
  return `<section id="comments">
<h2>Comments</h2>
${page.comments.length > 0 ? `<ul>${comments}</ul>` : '<p class="meta">No comments yet. The agent reads comments when it updates the page.</p>'}
<form method="post"><input type="hidden" name="action" value="comment">
<textarea name="body" maxlength="2000" required placeholder="What should change?"></textarea>
<p><button type="submit">Add comment</button></p></form>
</section>
<section>
<h2>Versions</h2>
<ul>${versions}</ul>
</section>
${manageSection(page)}`;
}

/** The artifact inside its sandboxed frame, with the history, comments and controls below it. */
export function artifactPage(page: ArtifactPage): Response {
  const { artifact } = page;
  const old = page.shownVersion !== artifact.version;
  return document(
    artifact.title,
    `<header>
<a class="brand" href="/a">Jujurly</a>
<h1>${escapeHtml(artifact.title)}</h1>
<span class="meta">${escapeHtml(artifact.ownerName)} · ${escapeHtml(artifact.organizationName)} · version ${page.shownVersion}${old ? " (old)" : ""} · ${day(artifact.updatedAt)}</span>
<span class="spacer"></span>
<span class="badge">${artifact.visibility === "public" ? "Public link" : "Organization"}</span>
${page.member ? '<a class="meta" href="#comments">Comments and versions</a>' : ""}
</header>
<iframe title="${escapeHtml(artifact.title)}" sandbox="${ARTIFACT_FRAME_SANDBOX}" referrerpolicy="no-referrer" srcdoc="${escapeHtml(page.html)}"></iframe>
<main>${memberSections(page)}</main>`,
  );
}
