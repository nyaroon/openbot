// Takes from the upstream repository only the commits that matter to this fork.
//
//   bun scripts/upstream-sync.ts check          list new upstream commits, sorted into take and skip
//   bun scripts/upstream-sync.ts apply          cherry-pick the "take" commits onto a new local branch
//   bun scripts/upstream-sync.ts mark [commit]  record that upstream was reviewed up to this commit
//
// A commit is skipped when its subject matches `skipSubjects`, or when every file it changes is
// under `skipPaths` or was removed in this fork. Nothing is pushed and the current branch is never
// changed: `apply` works on a new branch that you review and merge yourself.
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

interface SyncConfig {
  upstream: string;
  lastReviewed: string;
  skipSubjects: string[];
  skipPaths: string[];
}

interface ChangedFile {
  status: string;
  path: string;
}

interface UpstreamCommit {
  hash: string;
  date: string;
  subject: string;
  files: ChangedFile[];
}

interface Sorted {
  commit: UpstreamCommit;
  take: boolean;
  reason: string;
  /** Files that this fork also changed, so the cherry-pick can conflict. */
  forkChanged: string[];
}

const root = join(import.meta.dirname, "..");
const configPath = join(root, "upstream-sync.config.json");
const reportDirectory = join(root, ".upstream-sync");
const noHooksDirectory = join(reportDirectory, "no-hooks");
const RECORD_SEPARATOR = "\u001e";
const FIELD_SEPARATOR = "\u001f";

function say(text: string): void {
  process.stdout.write(`${text}
`);
}

function git(args: string[], allowFailure = false): { ok: boolean; out: string } {
  try {
    const out = execFileSync("git", args, {
      cwd: root,
      encoding: "utf8",
      maxBuffer: 256 * 1024 * 1024,
      stdio: ["ignore", "pipe", "pipe"],
    });
    return { ok: true, out };
  } catch (error) {
    if (!allowFailure) throw error;
    return { ok: false, out: error instanceof Error ? error.message : String(error) };
  }
}

function readConfig(): SyncConfig {
  const parsed: SyncConfig = JSON.parse(readFileSync(configPath, "utf8"));
  return parsed;
}

function lines(text: string): string[] {
  return text.split("\n").filter((line) => line.length > 0);
}

function upstreamCommits(config: SyncConfig): UpstreamCommit[] {
  const remote = config.upstream.split("/", 1)[0] ?? "upstream";
  git(["fetch", remote, "--quiet"]);
  const format = `${RECORD_SEPARATOR}%H${FIELD_SEPARATOR}%ad${FIELD_SEPARATOR}%s`;
  const range = `${config.lastReviewed}..${config.upstream}`;
  const log = git([
    "log",
    "--reverse",
    "--no-merges",
    "--date=short",
    `--format=${format}`,
    "--name-status",
    range,
  ]).out;
  return log
    .split(RECORD_SEPARATOR)
    .filter((record) => record.trim().length > 0)
    .map((record) => {
      const [head = "", ...rest] = record.split("\n");
      const [hash = "", date = "", subject = ""] = head.split(FIELD_SEPARATOR);
      const files = lines(rest.join("\n")).map((line) => {
        const parts = line.split("\t");
        // A rename has the old and the new path. The new one decides.
        return { status: parts[0] ?? "", path: parts.at(-1) ?? "" };
      });
      return { hash, date, subject, files };
    });
}

function sortCommits(config: SyncConfig, commits: UpstreamCommit[]): Sorted[] {
  const subjects = config.skipSubjects.map((pattern) => new RegExp(pattern, "i"));
  const ours = new Set(lines(git(["ls-files"]).out));
  const base = git(["merge-base", "HEAD", config.upstream]).out.trim();
  const forkFiles = new Set(lines(git(["diff", "--name-only", base, "HEAD"]).out));
  const outOfScope = (path: string) => config.skipPaths.some((prefix) => path.startsWith(prefix));
  // An upstream change to a file that this fork no longer has is a change to a removed feature.
  const removedHere = (file: ChangedFile) => !file.status.startsWith("A") && !ours.has(file.path);

  return commits.map((commit) => {
    const forkChanged = commit.files
      .filter((file) => forkFiles.has(file.path) && ours.has(file.path))
      .map((file) => file.path);
    const matched = subjects.find((pattern) => pattern.test(commit.subject));
    if (matched) return { commit, take: false, reason: `subject matches ${matched.source}`, forkChanged };
    if (commit.files.length === 0) return { commit, take: false, reason: "changes no file", forkChanged };
    const kept = commit.files.filter((file) => !outOfScope(file.path) && !removedHere(file));
    if (kept.length === 0) return { commit, take: false, reason: "only removed or out-of-scope files", forkChanged };
    return { commit, take: true, reason: `${kept.length} of ${commit.files.length} files apply`, forkChanged };
  });
}

function reportLine(entry: Sorted): string {
  const risk = entry.forkChanged.length > 0 ? ` [touches ${entry.forkChanged.length} fork-changed files]` : "";
  return `- ${entry.commit.hash.slice(0, 9)} ${entry.commit.date} ${entry.commit.subject} (${entry.reason})${risk}`;
}

function writeReport(name: string, sections: [string, string[]][]): string {
  mkdirSync(reportDirectory, { recursive: true });
  const path = join(reportDirectory, name);
  const body = sections.map(([title, rows]) => `## ${title} (${rows.length})\n\n${rows.join("\n")}\n`).join("\n");
  writeFileSync(path, body);
  return path;
}

function check(): void {
  const config = readConfig();
  const sorted = sortCommits(config, upstreamCommits(config));
  const take = sorted.filter((entry) => entry.take);
  const skip = sorted.filter((entry) => !entry.take);
  const path = writeReport("check.md", [
    ["Take", take.map(reportLine)],
    ["Skip", skip.map(reportLine)],
  ]);
  const risky = take.filter((entry) => entry.forkChanged.length > 0).length;
  say(
    `${sorted.length} new upstream commits: ${take.length} to take (${risky} touch fork-changed files), ${skip.length} to skip.`,
  );
  say(`Report: ${path}`);
}

function unmerged(): ChangedFile[] {
  return lines(git(["status", "--porcelain"]).out)
    .map((line) => ({ status: line.slice(0, 2), path: line.slice(3) }))
    .filter((entry) => entry.status.includes("U") || entry.status === "AA" || entry.status === "DD");
}

/** Settles the conflicts that have one right answer here: a file this fork removed stays removed. */
function settleRemovedFiles(): boolean {
  const conflicts = unmerged();
  // DU: deleted by us, changed by them. Every other conflict needs a person.
  if (conflicts.some((entry) => entry.status !== "DU")) return false;
  for (const entry of conflicts) git(["rm", "--quiet", "--", entry.path]);
  return unmerged().length === 0;
}

function apply(): void {
  const config = readConfig();
  if (git(["status", "--porcelain"]).out.trim().length > 0) {
    throw new Error("The working tree has changes. Commit or stash them before `apply`.");
  }
  const take = sortCommits(config, upstreamCommits(config)).filter((entry) => entry.take);
  const last = take.at(-1);
  if (!last) {
    say("Nothing to take.");
    return;
  }
  const branch = `upstream-sync/${new Date().toISOString().slice(0, 10)}-${last.commit.hash.slice(0, 7)}`;
  mkdirSync(noHooksDirectory, { recursive: true });
  git(["switch", "--create", branch]);
  const picked: string[] = [];
  const empty: string[] = [];
  const manual: string[] = [];
  for (const entry of take) {
    const pick = git(["cherry-pick", "-x", "--allow-empty", entry.commit.hash], true);
    if (pick.ok) {
      picked.push(reportLine(entry));
      continue;
    }
    if (settleRemovedFiles()) {
      if (git(["diff", "--cached", "--quiet"], true).ok) {
        // Everything the commit changed is gone in this fork.
        git(["cherry-pick", "--skip"]);
        empty.push(reportLine(entry));
        continue;
      }
      // A plain cherry-pick runs no pre-commit hook, so the settled one runs none either. The
      // checks run once on the finished branch, not on each upstream commit.
      const settled = git(
        ["-c", "core.editor=true", "-c", `core.hooksPath=${noHooksDirectory}`, "cherry-pick", "--continue"],
        true,
      );
      if (settled.ok) {
        picked.push(reportLine(entry));
        continue;
      }
    }
    const files = unmerged().map((file) => file.path);
    git(["cherry-pick", "--abort"]);
    manual.push(`${reportLine(entry)}\n  - conflicts: ${files.join(", ")}`);
  }
  const path = writeReport("apply.md", [
    ["Picked", picked],
    ["Empty after removing fork-deleted files", empty],
    ["Needs a person (conflict, not applied)", manual],
  ]);
  say(`Branch ${branch}: ${picked.length} picked, ${empty.length} empty, ${manual.length} need a person.`);
  say(`Report: ${path}`);
  say("Next: run the typechecks and the build on this branch, then merge it yourself. Nothing was pushed.");
}

function mark(commit: string | undefined): void {
  const config = readConfig();
  const target = git(["rev-parse", commit ?? config.upstream]).out.trim();
  writeFileSync(configPath, `${JSON.stringify({ ...config, lastReviewed: target }, null, 2)}\n`);
  say(`Upstream is reviewed up to ${target}.`);
}

const [command, argument] = process.argv.slice(2);
if (!existsSync(configPath)) throw new Error(`Missing ${configPath}`);
if (command === "check") check();
else if (command === "apply") apply();
else if (command === "mark") mark(argument);
else say("Usage: bun scripts/upstream-sync.ts check | apply | mark [commit]");
