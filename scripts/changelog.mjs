#!/usr/bin/env node
/**
 * Interactive changelog + version maintenance tool.
 *
 * Adds a new release entry to `src/changelog.json` and bumps the `version`
 * field in `package.json`. The in-app "What's New" dialog reads the version
 * (injected at build time) and the changelog data to show users what changed
 * since their last update.
 *
 * Usage:
 *   node scripts/changelog.mjs                 # interactive (prompts for bump + changes)
 *   node scripts/changelog.mjs --patch         # pre-select bump type
 *   node scripts/changelog.mjs --minor
 *   node scripts/changelog.mjs --major
 *   node scripts/changelog.mjs --version 2.3.0 # explicit version
 *   node scripts/changelog.mjs --show          # print current version + latest release
 *
 * Changelog entries (the usual path): each change brings its own file in
 * changelog/unreleased/ ({ bump, changes, deploy? }, see its README), written
 * with the change itself. A release collects them into one entry.
 *   node scripts/changelog.mjs --unreleased       # preview the next release,
 *                                                 # and list PR merges and
 *                                                 # direct commits since the
 *                                                 # last release with no entry
 *   node scripts/changelog.mjs --collect          # entries -> one release in
 *                                                 # src/changelog.json +
 *                                                 # package.json, then delete
 *                                                 # the entry files
 *   node scripts/changelog.mjs --collect --dry-run          # preview only
 *   node scripts/changelog.mjs --collect --version 3.9.0    # pin the number
 *   node scripts/changelog.mjs --check            # validate every entry file
 *   node scripts/changelog.mjs --check --require-entry origin/dev
 *                                                 # ...and fail unless this
 *                                                 # branch adds or edits one
 *                                                 # (the PR check)
 *
 * LLM-assisted workflow (use any model, then review/revise the result):
 *   node scripts/changelog.mjs --prompt              # print a copy-paste prompt
 *                                                    # (schema + recent commits)
 *   node scripts/changelog.mjs --from-file draft.json # apply a specific draft
 *   node scripts/changelog.mjs --from-file            # apply ./changelog.draft.json,
 *                                                     # then delete it (--keep retains)
 *   cat draft.json | node scripts/changelog.mjs --stdin
 *   Re-running with the same version REPLACES that release (edit the draft and
 *   re-apply), so the review/revise loop never duplicates entries.
 *   node scripts/changelog.mjs --set-version 2.1.3  # retarget the latest
 *                                                   # release's version
 *                                                   # (syncs both files)
 *
 * Shipping a release (after the changelog is reviewed and confirmed):
 *   node scripts/changelog.mjs --release            # commit on dev, merge
 *                                                   # --no-ff into main, tag
 *                                                   # vX.Y.Z, ff dev, push,
 *                                                   # publish the GH release
 *   node scripts/changelog.mjs --release --dry-run  # print steps, run nothing
 *   node scripts/changelog.mjs --release --no-push  # local steps only
 *   Releases are always cut from dev; --release refuses to run elsewhere.
 *
 * Typically run via `yarn changelog`, or as part of `yarn release`
 * (`yarn changelog && yarn deploy`).
 */

import { readFile, writeFile, unlink, readdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { createInterface } from "node:readline";
import { execFileSync } from "node:child_process";
import { stdin as input, stdout as output } from "node:process";

// Minimal line reader that works for both interactive input (lines arrive as
// the user answers each prompt) and fully-buffered piped input (all lines
// arrive at once). readline/promises' question() drops buffered lines emitted
// before the next await, so we queue lines ourselves. question() resolves to
// null at end-of-input.
function createLineReader(inputStream, outputStream) {
  const rl = createInterface({ input: inputStream, terminal: false });
  const queue = [];
  const waiters = [];
  let closed = false;
  rl.on("line", (line) => {
    const waiter = waiters.shift();
    if (waiter) waiter(line);
    else queue.push(line);
  });
  rl.on("close", () => {
    closed = true;
    while (waiters.length) waiters.shift()(null);
  });
  return {
    question(prompt) {
      if (prompt) outputStream.write(prompt);
      if (queue.length) return Promise.resolve(queue.shift());
      if (closed) return Promise.resolve(null);
      return new Promise((resolve) => waiters.push(resolve));
    },
    close() {
      rl.close();
    },
  };
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const PACKAGE_PATH = join(ROOT, "package.json");
const CHANGELOG_PATH = join(ROOT, "src", "changelog.json");
// Default drop-spot for an LLM-produced draft: `yarn changelog:apply` with no
// path reads this file, applies it, then deletes it (pass --keep to retain).
const DEFAULT_DRAFT_PATH = join(ROOT, "changelog.draft.json");

const CHANGE_TYPES = ["added", "changed", "fixed", "removed"];

// Changelog entries: each change brings its own file here, written with the
// change, and a release collects them into one entry. One file per change
// means no commit or PR edits src/changelog.json or package.json, so two
// branches never conflict over the changelog or a version number.
const ENTRIES_DIR = join(ROOT, "changelog", "unreleased");
// The same directory as git prints paths, relative to the repository root.
const ENTRIES_PATH = "changelog/unreleased";
const BUMPS = ["patch", "minor", "major"];
const ENTRY_KEYS = ["bump", "changes", "deploy"];

const args = process.argv.slice(2);
const hasFlag = (flag) => args.includes(flag);
const getFlagValue = (flag) => {
  const index = args.indexOf(flag);
  return index !== -1 ? args[index + 1] : null;
};

function parseVersion(version) {
  return String(version || "0")
    .split(".")
    .map((segment) => parseInt(segment, 10) || 0);
}

function bumpVersion(current, type) {
  const [major, minor, patch] = parseVersion(current);
  if (type === "major") return `${major + 1}.0.0`;
  if (type === "minor") return `${major}.${minor + 1}.0`;
  return `${major}.${minor}.${patch + 1}`;
}

function isValidVersion(version) {
  return /^\d+\.\d+\.\d+$/.test(String(version || "").trim());
}

function todayISO() {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(
    now.getDate()
  )}`;
}

async function readJSON(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

async function readStdin() {
  const chunks = [];
  for await (const chunk of input) chunks.push(chunk);
  return Buffer.concat(chunks).toString("utf8").trim();
}

// Best-effort list of commit subjects since the last released version, to give
// the LLM context. Falls back to the last 30 commits, or "" if git is absent.
function gitCommitsSinceLastRelease(latestVersion) {
  const run = (a) => execFileSync("git", a, { encoding: "utf8" }).trim();
  const refExists = (ref) => {
    try {
      execFileSync("git", ["rev-parse", "--verify", "--quiet", ref], {
        stdio: "ignore",
      });
      return true;
    } catch {
      return false;
    }
  };
  try {
    const candidates = latestVersion
      ? [`v${latestVersion}`, latestVersion]
      : [];
    for (const ref of candidates) {
      if (refExists(ref)) {
        return run([
          "log",
          `${ref}..HEAD`,
          "--no-merges",
          "--pretty=format:- %s",
        ]);
      }
    }
    return run(["log", "-n", "30", "--no-merges", "--pretty=format:- %s"]);
  } catch {
    return "";
  }
}

// Build a self-contained prompt a developer can paste into any LLM to draft a
// release. The model returns JSON matching the schema, which is then applied
// via --from-file / --stdin.
function buildDraftPrompt(currentVersion, latestVersion, entries = []) {
  const commits = gitCommitsSinceLastRelease(latestVersion);
  // With entry files waiting, the draft is one more entry covering only what
  // they miss (typically commits that came without one), then `--collect`
  // releases them all together.
  const asEntry = entries.length > 0;
  const head = asEntry
    ? `You are writing a changelog entry for "PTN Ninja", covering the commits below that no existing entry covers.
Output ONLY a JSON object (no markdown fences, no commentary) matching this schema:

{
  "bump": "patch|minor|major", // REQUIRED: see the bump rule below
  "changes": [`
    : `You are drafting a changelog release entry for "PTN Ninja".
Output ONLY a JSON object (no markdown fences, no commentary) matching this schema:

{
  "version": "x.y.z",          // REQUIRED: pick one of the suggested versions below
  "date": "${todayISO()}",       // OPTIONAL: release date (YYYY-MM-DD); defaults to today
  "changes": [`;
  const versionRule = asEntry
    ? `- Set "bump" by IMPACT, not category: patch for fixes AND small refinements/tweaks to existing features (when in doubt, choose patch); minor for substantial new capabilities a user would notice as something new; major for breaking changes. The release takes the largest bump among all entries.`
    : `- Set "version" explicitly (not a bump keyword). Choose the bump by IMPACT, not category: patch for fixes AND small refinements/tweaks to existing features (when in doubt, choose patch); reserve minor for substantial new capabilities a user would notice as something new; major for breaking changes.`;
  const covered = asEntry
    ? `
- These changes already have entries in ${ENTRIES_PATH}/ and ship as written. Do NOT repeat them; write entries only for the commits they don't cover. If they cover everything, say so instead of writing JSON.
${entries
  .flatMap((entry) =>
    entry.changes.map(
      (change) => `    - ${formatChange(change)} (${entry.name})`
    )
  )
  .join("\n")}
- Save the result as a new file in ${ENTRIES_PATH}/ (for example catch-up-${todayISO()}.json), then run \`yarn changelog:collect\`.`
    : "";
  return `${head}
    {
      "type": "added|changed|fixed|removed",
      "description": "concise, plain-language summary"
    }
  ]
}

Rules:
- Output STRICTLY VALID JSON that JSON.parse can read. In string values (especially "description"), do NOT use raw double-quote characters — write quoted terms with single quotes (e.g. 'New Address') or curly quotes (e.g. \u201cNew Address\u201d) instead. Never leave an unescaped " inside a string.
${versionRule}${covered}
- One entry per meaningful, user-noticeable change. Group trivial commits together; skip pure chores (dependency bumps, lint, formatting) unless notable.
- Order the "changes" array by excitement/impact, most exciting first. As a general guide lead with "added" (new capabilities), then "changed" (improvements), then "fixed" (bug fixes); within each group, put the higher-impact items first. Place "removed" wherever it best fits the impact ordering (your discretion).
- Current version: ${currentVersion}. Suggested next: patch=${bumpVersion(
    currentVersion,
    "patch"
  )}, minor=${bumpVersion(currentVersion, "minor")}, major=${bumpVersion(
    currentVersion,
    "major"
  )}.

Recent commits${latestVersion ? ` since v${latestVersion}` : ""}:
${
  commits ||
  "(no git history available — summarize from your knowledge of the changes)"
}`;
}

// Validate and normalize a single change entry from a draft. Throws on hard
// errors; warns (but keeps going) on soft issues.
function normalizeChange(raw, index, label = "changes") {
  const where = `${label}[${index}]`;
  if (!raw || typeof raw !== "object") {
    throw new Error(`${where} must be an object.`);
  }
  const type = String(raw.type || "")
    .trim()
    .toLowerCase();
  if (!CHANGE_TYPES.includes(type)) {
    throw new Error(
      `${where}.type must be one of: ${CHANGE_TYPES.join(", ")}.`
    );
  }
  const description = String(raw.description || "").trim();
  if (!description) {
    throw new Error(`${where}.description is required.`);
  }
  return { type, description };
}

// Resolve the target version from a draft (explicit "version" or "bump").
function resolveDraftVersion(draft, currentVersion) {
  if (draft.version) {
    if (!isValidVersion(draft.version)) {
      throw new Error(`Invalid version: "${draft.version}" (expected x.y.z).`);
    }
    return draft.version.trim();
  }
  if (draft.bump) {
    const bump = String(draft.bump).toLowerCase();
    if (!["patch", "minor", "major"].includes(bump)) {
      throw new Error(`Invalid bump: "${draft.bump}" (patch|minor|major).`);
    }
    return bumpVersion(currentVersion, bump);
  }
  throw new Error('Draft must include either "version" or "bump".');
}

// One change as `--show` and `--unreleased` print it.
function formatChange(change) {
  return `[${change.type}] ${change.description}`;
}

// Validate one entry file's parsed JSON. Throws with the file's name on hard
// errors; returns { name, bump, changes, deploy } with `deploy` always a list.
// An entry carries a bump, never a version: the release picks the number from
// the largest bump among its entries, so entries written days apart agree.
export function validateEntry(raw, name) {
  const fail = (message) => {
    throw new Error(`${name}: ${message}`);
  };
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    fail("must be a JSON object.");
  }
  if ("version" in raw) {
    fail(
      'has a "version"; an entry carries a "bump" and the release picks the number.'
    );
  }
  const unknown = Object.keys(raw).filter((key) => !ENTRY_KEYS.includes(key));
  if (unknown.length) {
    fail(
      `unknown key(s): ${unknown.join(", ")} (allowed: ${ENTRY_KEYS.join(
        ", "
      )}).`
    );
  }
  const bump = String(raw.bump || "")
    .trim()
    .toLowerCase();
  if (!BUMPS.includes(bump)) {
    fail(`"bump" must be one of: ${BUMPS.join(", ")}.`);
  }
  if (!Array.isArray(raw.changes) || !raw.changes.length) {
    fail('needs a non-empty "changes" array.');
  }
  let changes;
  try {
    changes = raw.changes.map((change, index) =>
      normalizeChange(change, index)
    );
  } catch (error) {
    fail(error.message);
  }
  // Steps beyond deploying the hosting build (deploy the functions, rebuild a
  // wasm bundle), printed at release time and never shown to users.
  let deploy = raw.deploy ?? [];
  if (!Array.isArray(deploy)) deploy = [deploy];
  deploy = deploy.map((step, index) => {
    if (typeof step !== "string" || !step.trim()) {
      fail(
        `deploy[${index}] must be a non-empty sentence for whoever deploys.`
      );
    }
    return step.trim();
  });
  return { name, bump, changes, deploy };
}

// Unix time of the commit that added `file`, so entries collect in the order
// they landed. Infinity for a file git doesn't know yet (or outside a repo).
function landedAt(dir, file) {
  try {
    const times = execFileSync(
      "git",
      ["log", "--diff-filter=A", "--format=%ct", "--", file],
      { cwd: dir, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }
    )
      .split("\n")
      .filter(Boolean);
    return times.length ? Number(times[times.length - 1]) : Infinity;
  } catch {
    return Infinity;
  }
}

// The entry files' names (any README or other non-JSON file is ignored).
export async function entryFileNames(dir = ENTRIES_DIR) {
  try {
    return (await readdir(dir)).filter((name) => name.endsWith(".json")).sort();
  } catch (error) {
    if (error.code === "ENOENT") return [];
    throw error;
  }
}

// Read and validate every entry file, oldest first. Reports every bad file at
// once rather than stopping at the first.
export async function readEntries(dir = ENTRIES_DIR) {
  const entries = [];
  const problems = [];
  for (const name of await entryFileNames(dir)) {
    let parsed;
    try {
      parsed = JSON.parse(await readFile(join(dir, name), "utf8"));
    } catch (error) {
      problems.push(
        `${name}: not valid JSON (${error.message}). A common cause is a raw ` +
          "double quote inside a description: use single or curly quotes."
      );
      continue;
    }
    try {
      entries.push({
        ...validateEntry(parsed, name),
        landed: landedAt(dir, name),
      });
    } catch (error) {
      problems.push(error.message);
    }
  }
  if (problems.length) {
    throw new Error(
      `Changelog entries in ${ENTRIES_PATH}/ need fixing:\n  ${problems.join(
        "\n  "
      )}`
    );
  }
  return entries.sort(
    (a, b) => a.landed - b.landed || a.name.localeCompare(b.name)
  );
}

// Combine entries into one release: the largest bump sets the version
// (unless `version` pins it), changes run added → changed → fixed → removed
// with each type in the order the entries landed, and every deploy step is
// kept with the entry it came from.
export function combineEntries(entries, currentVersion, version) {
  if (!entries.length) {
    throw new Error(`No changelog entries in ${ENTRIES_PATH}/ to collect.`);
  }
  if (version != null && !isValidVersion(version)) {
    throw new Error(`Invalid version: "${version}" (expected x.y.z).`);
  }
  const bump = entries.reduce(
    (largest, entry) =>
      BUMPS.indexOf(entry.bump) > BUMPS.indexOf(largest) ? entry.bump : largest,
    "patch"
  );
  const rank = (change) => CHANGE_TYPES.indexOf(change.type);
  return {
    version: version ? version.trim() : bumpVersion(currentVersion, bump),
    bump,
    changes: entries
      .flatMap((entry) => entry.changes)
      .sort((a, b) => rank(a) - rank(b)),
    deploy: entries.flatMap((entry) =>
      entry.deploy.map((step) => ({ entry: entry.name, step }))
    ),
  };
}

const isEntryPath = (path) =>
  path.startsWith(`${ENTRIES_PATH}/`) && path.endsWith(".json");

// Entry files this branch adds or edits relative to `base` (a PR's target),
// as the PR check needs.
export function entriesTouched(base, cwd = ROOT) {
  return execFileSync(
    "git",
    [
      "diff",
      "--name-only",
      "--diff-filter=AMR",
      `${base}...HEAD`,
      "--",
      ENTRIES_PATH,
    ],
    { cwd, encoding: "utf8" }
  )
    .split("\n")
    .filter(isEntryPath);
}

// Which of the changes since `base` brought an entry. A PR merge ("Merge pull
// request #N") counts when the PR added or edited an entry file; a commit that
// reached dev outside any PR (pushed straight to dev) counts when the commit
// itself did. Other merges (a local dev pulling origin/dev, a release merge)
// are plumbing and skipped. Returns { prs: [{ sha, number, title, entries }],
// direct: [{ sha, author, subject, entries }] }, newest first.
export function entryCoverage(base, cwd = ROOT) {
  const git = (args) =>
    execFileSync("git", args, {
      cwd,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
  const lines = (text) => text.split("\n").filter(Boolean);
  const range = `${base}..HEAD`;
  const prs = [];
  const inPR = new Set();
  const merges = git(["log", "--merges", "--format=%H%x1f%s%x1f%b%x1e", range])
    .split("\x1e")
    .map((record) => record.replace(/^\n+/, ""))
    .filter(Boolean);
  for (const record of merges) {
    const [sha, subject, body = ""] = record.split("\x1f");
    const match = /^Merge pull request #(\d+)/.exec(subject);
    if (!match) continue;
    lines(git(["rev-list", `${sha}^1..${sha}^2`])).forEach((commit) =>
      inPR.add(commit)
    );
    const title = lines(body)[0] || subject;
    const entries = lines(
      git([
        "diff",
        "--name-only",
        "--diff-filter=AMR",
        `${sha}^1`,
        sha,
        "--",
        ENTRIES_PATH,
      ])
    ).filter(isEntryPath);
    prs.push({ sha, number: Number(match[1]), title: title.trim(), entries });
  }
  const direct = [];
  for (const line of lines(
    git(["log", "--no-merges", "--format=%H%x1f%an%x1f%s", range])
  )) {
    const [sha, author, subject] = line.split("\x1f");
    if (inPR.has(sha)) continue;
    const entries = lines(
      git([
        "diff-tree",
        "--no-commit-id",
        "--name-only",
        "--diff-filter=AMR",
        "-r",
        sha,
        "--",
        ENTRIES_PATH,
      ])
    ).filter(isEntryPath);
    direct.push({ sha, author, subject, entries });
  }
  return { prs, direct };
}

// The release `--collect` would write, as `--unreleased` and
// `--collect --dry-run` print it.
function printUpcoming(release, entries, currentVersion) {
  console.log(
    `\nNext release: v${release.version} (${release.bump} bump from ` +
      `v${currentVersion}), ${release.changes.length} change(s) from ` +
      `${entries.length} entr${entries.length === 1 ? "y" : "ies"}.\n`
  );
  release.changes.forEach((change) =>
    console.log(`  - ${formatChange(change)}`)
  );
  if (release.deploy.length) {
    console.log("\nDeploy steps from the entries:");
    release.deploy.forEach(({ entry, step }) =>
      console.log(`  - ${step} (${entry})`)
    );
  }
}

// Throw when entries wait in changelog/unreleased/, with `advice` saying what
// to do instead.
async function refuseWhileEntriesWait(advice) {
  const waiting = await entryFileNames();
  if (waiting.length) {
    throw new Error(
      `${waiting.length} changelog entr${
        waiting.length === 1 ? "y is" : "ies are"
      } waiting in ${ENTRIES_PATH}/ (${waiting.join(", ")}). ${advice}`
    );
  }
}

// Format changelog.json with the project's prettier so short arrays collapse
// onto one line, matching a manual `npx prettier --write`. Best-effort: warn
// and continue if prettier isn't available.
function formatChangelogWithPrettier() {
  const prettierBin = join(ROOT, "node_modules", ".bin", "prettier");
  try {
    execFileSync(prettierBin, ["--write", CHANGELOG_PATH], { stdio: "ignore" });
  } catch {
    console.log(
      "  ⚠ prettier unavailable; run `npx prettier --write src/changelog.json`."
    );
  }
}

// Persist changelog.json, then run prettier so short arrays stay collapsed
// onto one line.
async function writeChangelog(changelog) {
  await writeFile(
    CHANGELOG_PATH,
    JSON.stringify(changelog, null, 2) + "\n",
    "utf8"
  );
  formatChangelogWithPrettier();
}

// Targeted replace of the version line to avoid reformatting package.json.
async function syncPackageVersion(version) {
  const rawPkg = await readFile(PACKAGE_PATH, "utf8");
  const updatedPkg = rawPkg.replace(
    /("version":\s*")[^"]*(")/,
    `$1${version}$2`
  );
  await writeFile(PACKAGE_PATH, updatedPkg, "utf8");
}

// Insert or replace a release, then persist changelog.json + package.json.
// Replacing (same version) keeps the review/revise loop idempotent.
async function writeRelease(changelog, { version, date, changes }) {
  const existingIndex = changelog.releases.findIndex(
    (release) => release.version === version
  );
  const release = { version, date: date || todayISO(), changes };
  if (existingIndex !== -1) {
    changelog.releases[existingIndex] = release;
  } else {
    changelog.releases.unshift(release);
  }
  changelog.releases.sort((a, b) => compareVersionsDesc(a.version, b.version));

  await writeChangelog(changelog);
  await syncPackageVersion(version);

  const verb = existingIndex !== -1 ? "Updated" : "Released";
  console.log(
    `\n✅ ${verb} v${version} (${release.date}) with ${changes.length} change(s).`
  );
  console.log("   Updated: package.json, src/changelog.json");
  console.log(
    "   Review with `git diff`, revise if needed, then commit and deploy.\n"
  );
}

// Apply a validated draft object ({ version|bump, date?, changes[] }).
async function applyDraft(changelog, draft, currentVersion) {
  if (!draft || typeof draft !== "object") {
    throw new Error("Draft must be a JSON object.");
  }
  if (!Array.isArray(draft.changes) || !draft.changes.length) {
    throw new Error('Draft must include a non-empty "changes" array.');
  }
  if (draft.date && !/^\d{4}-\d{2}-\d{2}$/.test(String(draft.date).trim())) {
    throw new Error(`Invalid date: "${draft.date}" (expected YYYY-MM-DD).`);
  }
  const version = resolveDraftVersion(draft, currentVersion);
  const changes = draft.changes.map((change, index) =>
    normalizeChange(change, index)
  );
  await writeRelease(changelog, { version, date: draft.date, changes });
}

// Retarget the latest release to a different version (e.g. downgrade a minor
// bump to a patch), updating src/changelog.json and package.json together so
// the two never drift.
async function setLatestVersion(changelog, newVersion) {
  if (!isValidVersion(newVersion)) {
    throw new Error(`Invalid version: "${newVersion}" (expected x.y.z).`);
  }
  newVersion = newVersion.trim();
  const latest = changelog.releases[0];
  if (!latest) throw new Error("No releases recorded in src/changelog.json.");
  const oldVersion = latest.version;
  if (newVersion === oldVersion) {
    console.log(`\nLatest release is already v${newVersion}.\n`);
    return;
  }
  if (
    changelog.releases.some(
      (release) => release !== latest && release.version === newVersion
    )
  ) {
    throw new Error(
      `Release ${newVersion} already exists — pick another version.`
    );
  }
  latest.version = newVersion;
  changelog.releases.sort((a, b) => compareVersionsDesc(a.version, b.version));
  await writeChangelog(changelog);
  await syncPackageVersion(newVersion);
  console.log(`\n✅ Renamed release v${oldVersion} → v${newVersion}.`);
  console.log("   Updated: package.json, src/changelog.json\n");
}

// Ship the latest changelog release. Policy: releases are always cut from
// `dev`. The release commit lands on `dev`, which is merged --no-ff into
// `main` as `vX.Y.Z` (with the release's changes as the merge body), the
// merge commit is tagged `vX.Y.Z`, `dev` is fast-forwarded back to `main`,
// everything is pushed to origin, and the GitHub release is published. Run
// from any other branch and this refuses to touch git history. --dry-run
// prints the steps without executing them; --no-push performs the local steps
// but skips both the push and the GitHub release, which needs the pushed
// tag.
async function releaseLatest(changelog, pkg, { dryRun, push }) {
  const DEV_BRANCH = "dev";
  const MAIN_BRANCH = "main";
  const RELEASE_FILES = ["src/changelog.json", "package.json"];

  const latest = changelog.releases[0];
  if (!latest) throw new Error("No releases recorded in src/changelog.json.");
  const version = latest.version;
  const tag = `v${version}`;
  if (pkg.version !== version) {
    throw new Error(
      `package.json (${pkg.version}) and the latest changelog release ` +
        `(${version}) are out of sync. Apply a draft first.`
    );
  }

  const gitOut = (args) =>
    execFileSync("git", args, { encoding: "utf8" }).trim();
  const step = (args) => {
    console.log(`  $ git ${args.join(" ")}`);
    if (!dryRun) execFileSync("git", args, { stdio: "inherit" });
  };

  // Safety checks (read-only, so they run even in dry-run mode).
  const branch = gitOut(["branch", "--show-current"]);
  if (branch !== DEV_BRANCH) {
    throw new Error(
      `Releases are cut from ${DEV_BRANCH}, but you're on "${branch}". ` +
        `Merge your work into ${DEV_BRANCH} first, then re-run.`
    );
  }
  let tagExists = true;
  try {
    execFileSync(
      "git",
      ["rev-parse", "--verify", "--quiet", `refs/tags/${tag}`],
      { stdio: "ignore" }
    );
  } catch {
    tagExists = false;
  }
  // Entries still waiting would miss this release and land in the next one.
  // Checked before the tag: uncollected entries also leave the latest release
  // pointing at the shipped tag, and "collect first" is the useful message.
  await refuseWhileEntriesWait(
    "Run `yarn changelog:collect` first so they ship in this release."
  );
  if (tagExists) {
    throw new Error(`Tag ${tag} already exists — this release has shipped.`);
  }
  // NB: no trim() here — porcelain lines start with a 2-char status + space,
  // and trimming the output would eat the first line's leading status space.
  const dirty = execFileSync("git", ["status", "--porcelain"], {
    encoding: "utf8",
  })
    .split("\n")
    .filter(Boolean)
    .map((line) => line.slice(3).split(" -> ").pop().replace(/^"|"$/g, ""));
  // Collecting deletes the entry files; the release commit carries that too.
  const collected = dirty.filter((path) => isEntryPath(path));
  const unexpected = dirty.filter(
    (path) => !RELEASE_FILES.includes(path) && !isEntryPath(path)
  );
  if (unexpected.length) {
    throw new Error(
      `Working tree has unrelated changes:\n    ${unexpected.join(
        "\n    "
      )}\n` + "  Commit or stash them before releasing."
    );
  }

  console.log(
    `\n${dryRun ? "Dry run: would release" : "Releasing"} ${tag} (${
      latest.date
    }) — ${latest.changes.length} change(s).\n`
  );

  // 1. Commit the release on dev (skip if the tree is already clean).
  if (dirty.length) {
    step(["add", "-A", "--", ...RELEASE_FILES, ...collected]);
    step(["commit", "-m", `chore(changelog): release ${tag}`]);
  } else {
    console.log(
      `  (working tree clean — assuming ${tag} is already committed)`
    );
  }

  // 2. Merge dev into main. The merge commit is the release in the history,
  // so it is named for it — `v3.6.0`, matching every release before this
  // script existed — rather than "Merge branch 'dev'". The simplified
  // changelog rides along in the body, so `git show` on the tag answers what
  // shipped without a network round trip.
  const bullets = latest.changes
    .map((change) => `- ${change.description}`)
    .join("\n");
  step(["checkout", MAIN_BRANCH]);
  try {
    step(["merge", "--no-ff", DEV_BRANCH, "-m", tag, "-m", bullets]);
  } catch (error) {
    throw new Error(
      `Merge into ${MAIN_BRANCH} failed: ${error.message}\n` +
        "  Resolve the conflicts, or back out with `git merge --abort` " +
        `and \`git checkout ${DEV_BRANCH}\`.`
    );
  }

  // 3. Tag the merge commit.
  step(["tag", tag]);

  // 4. Fast-forward dev so both branches sit on the tagged merge commit.
  step(["checkout", DEV_BRANCH]);
  step(["merge", "--ff-only", MAIN_BRANCH]);

  // 5. Push both branches and the tag.
  if (push) {
    step(["push", "origin", MAIN_BRANCH, DEV_BRANCH, tag]);
  } else {
    console.log("\n  Skipped push (--no-push). Push later with:");
    console.log(`    git push origin ${MAIN_BRANCH} ${DEV_BRANCH} ${tag}`);
  }

  // 6. Publish the GitHub release, in the shape these have been published by
  // hand: the same bullets as the merge body, then the compare link against
  // the previous release. Only with a pushed tag — GitHub has nothing to
  // attach a release to otherwise.
  if (push) {
    const previous = changelog.releases[1];
    const repoUrl = gitOut(["remote", "get-url", "origin"])
      .replace(/^git@github\.com:/, "https://github.com/")
      .replace(/\.git$/, "");
    const notes = previous
      ? `${bullets}\n\n**Full Changelog**: ` +
        `${repoUrl}/compare/v${previous.version}...${tag}`
      : bullets;
    const ghArgs = ["release", "create", tag, "--title", tag, "--notes", notes];

    console.log(`  $ gh release create ${tag} --title ${tag} --notes ...`);
    if (!dryRun) {
      try {
        execFileSync("gh", ghArgs, { stdio: "inherit" });
      } catch (error) {
        // The git side has already shipped and pushed; a missing or
        // unauthenticated gh is not a reason to fail the release. Say what
        // is left to do and let the caller finish it.
        console.warn(
          `\n⚠️  Could not create the GitHub release: ${error.message}\n` +
            `   Publish it manually at ${repoUrl}/releases/new?tag=${tag}, ` +
            "or re-run `gh release create` once `gh auth login` is done."
        );
      }
    }
  }

  console.log(`\n✅ ${dryRun ? "Dry run complete." : `Released ${tag}.`}\n`);
}

async function main() {
  const pkg = await readJSON(PACKAGE_PATH);
  const currentVersion = pkg.version;
  const changelog = await readJSON(CHANGELOG_PATH);
  if (!Array.isArray(changelog.releases)) {
    changelog.releases = [];
  }

  if (hasFlag("--help") || hasFlag("-h")) {
    console.log(
      [
        "Usage: node scripts/changelog.mjs [options]",
        "",
        "  (no options)          Interactive prompts for bump + changes",
        "  --patch|--minor|--major, --version x.y.z",
        "  --show                Print current version + latest release",
        `  --unreleased          Preview the next release from ${ENTRIES_PATH}/,`,
        "                        and list what landed since the last release",
        "                        without an entry",
        "  --collect             Write the entries as one release in",
        "                        src/changelog.json + package.json, then delete",
        "                        them (--dry-run previews; --version x.y.z pins it)",
        "  --check               Validate every entry file",
        "  --require-entry <ref> With --check: fail unless this branch adds or",
        "                        edits an entry relative to <ref> (the PR check)",
        "  --prompt              Print an LLM prompt (schema + recent commits);",
        "                        with entries waiting, it drafts one more entry",
        "                        covering only what they miss",
        "  --from-file [path]    Apply an LLM-produced JSON draft",
        "                        (defaults to ./changelog.draft.json, then deletes it)",
        "  --keep                Keep the default draft file after applying it",
        "  --stdin               Apply a JSON draft read from stdin",
        "  --set-version x.y.z   Retarget the latest release to a different",
        "                        version (syncs changelog.json + package.json)",
        "  --release             Ship the latest release: commit on dev, merge",
        "                        --no-ff into main as `vX.Y.Z` (changelog as",
        "                        merge body), tag it, fast-forward dev, push, and",
        "                        publish the GitHub release",
        "  --dry-run             With --release: print the git steps, run nothing",
        "  --no-push             With --release: do the local steps but skip pushing",
      ].join("\n")
    );
    return;
  }

  if (hasFlag("--show")) {
    console.log(`Current version: ${currentVersion}`);
    const latest = changelog.releases[0];
    if (latest) {
      console.log(`Latest release:  ${latest.version} (${latest.date})`);
      latest.changes.forEach((c) => console.log(`  - ${formatChange(c)}`));
    } else {
      console.log("No releases recorded yet.");
    }
    return;
  }

  const latestVersion = changelog.releases[0] && changelog.releases[0].version;

  if (hasFlag("--check")) {
    const entries = await readEntries();
    console.log(
      `✅ ${entries.length} changelog entr${
        entries.length === 1 ? "y" : "ies"
      } in ${ENTRIES_PATH}/ valid.`
    );
    if (hasFlag("--require-entry")) {
      const base = getFlagValue("--require-entry");
      if (!base || base.startsWith("--")) {
        throw new Error("--require-entry needs the branch to compare with.");
      }
      const touched = entriesTouched(base);
      if (!touched.length) {
        throw new Error(
          `No changelog entry: add a file to ${ENTRIES_PATH}/ (its README ` +
            "shows the format), or label the PR no-changelog if nobody using " +
            "the app will notice the change (tests, CI, refactors, or a fix " +
            "to something not yet released)."
        );
      }
      console.log(`✅ This change brings ${touched.join(", ")}.`);
    }
    return;
  }

  if (hasFlag("--unreleased")) {
    const entries = await readEntries();
    if (entries.length) {
      printUpcoming(
        combineEntries(entries, currentVersion),
        entries,
        currentVersion
      );
    } else {
      console.log(`\nNo changelog entries waiting in ${ENTRIES_PATH}/.`);
    }
    const tag = latestVersion && `v${latestVersion}`;
    let coverage = null;
    try {
      coverage = tag && entryCoverage(tag);
    } catch {
      coverage = null;
    }
    if (!coverage) {
      console.log(
        `\n(Tag ${tag || "for the last release"} not found locally; ` +
          "`git fetch --tags` to list what landed without an entry.)\n"
      );
      return;
    }
    const missingPRs = coverage.prs.filter((pr) => !pr.entries.length);
    const missingDirect = coverage.direct.filter(
      (commit) => !commit.entries.length
    );
    console.log(
      `\nSince ${tag}: ${coverage.prs.length} PR(s) merged, ` +
        `${coverage.direct.length} commit(s) pushed straight to dev.`
    );
    // Not every change needs an entry (a fix to unreleased work needs none),
    // so these are for a look, not a list of what's missing.
    if (missingPRs.length) {
      console.log("\nPRs that added no entry (fine if labelled no-changelog):");
      missingPRs.forEach((pr) => console.log(`  #${pr.number} ${pr.title}`));
    }
    if (missingDirect.length) {
      console.log("\nCommits pushed straight to dev that added no entry:");
      missingDirect.forEach((commit) =>
        console.log(
          `  ${commit.sha.slice(0, 9)} ${commit.author}: ${commit.subject}`
        )
      );
    }
    if (missingPRs.length || missingDirect.length) {
      console.log(
        "\nMost of these need none (fixes to unreleased work, tests, chores). " +
          "For any that people will notice, write an entry " +
          "(`yarn changelog:prompt` drafts one), then collect.\n"
      );
    } else {
      console.log("Every change since then brought an entry.\n");
    }
    return;
  }

  if (hasFlag("--collect")) {
    // A second collect would bump the already-bumped version again. Only the
    // version counts in package.json: other edits there (a new script, a
    // dependency) are no sign of an earlier collect.
    let committedVersion = currentVersion;
    let changelogEdited = false;
    try {
      committedVersion = JSON.parse(
        execFileSync("git", ["show", "HEAD:package.json"], {
          cwd: ROOT,
          encoding: "utf8",
          stdio: ["ignore", "pipe", "ignore"],
        })
      ).version;
      execFileSync(
        "git",
        ["diff", "--quiet", "HEAD", "--", "src/changelog.json"],
        { cwd: ROOT, stdio: "ignore" }
      );
    } catch (error) {
      if (error.status === 1) changelogEdited = true;
    }
    if (changelogEdited || committedVersion !== currentVersion) {
      throw new Error(
        "src/changelog.json or the package.json version already has " +
          "uncommitted changes (an earlier collect?). To collect again, " +
          "restore them first: git checkout -- src/changelog.json " +
          `${ENTRIES_PATH}, and set the version back to ${committedVersion}.`
      );
    }
    const entries = await readEntries();
    const versionFlag = getFlagValue("--version");
    const release = combineEntries(
      entries,
      currentVersion,
      versionFlag && !versionFlag.startsWith("--") ? versionFlag : undefined
    );
    printUpcoming(release, entries, currentVersion);
    if (hasFlag("--dry-run")) {
      console.log("\nDry run: nothing written.\n");
      return;
    }
    await writeRelease(changelog, {
      version: release.version,
      changes: release.changes,
    });
    for (const entry of entries) {
      await unlink(join(ENTRIES_DIR, entry.name));
    }
    console.log(
      `   Removed ${entries.length} entry file(s) from ${ENTRIES_PATH}/. ` +
        "The release commit carries the removal.\n"
    );
    return;
  }

  if (hasFlag("--prompt")) {
    const entries = await readEntries();
    console.log(buildDraftPrompt(currentVersion, latestVersion, entries));
    return;
  }

  if (hasFlag("--release")) {
    await releaseLatest(changelog, pkg, {
      dryRun: hasFlag("--dry-run"),
      push: !hasFlag("--no-push"),
    });
    return;
  }

  if (hasFlag("--set-version")) {
    const newVersion = getFlagValue("--set-version");
    if (!newVersion || newVersion.startsWith("--")) {
      throw new Error("--set-version requires a version (x.y.z).");
    }
    await setLatestVersion(changelog, newVersion);
    return;
  }

  // Everything below writes a whole release (a draft, or the interactive
  // prompts). While entries wait, that release would ship without them and
  // they would land again in the next one.
  await refuseWhileEntriesWait(
    "Put any other changes in an entry file there too, then run " +
      "`yarn changelog:collect`, so each entry ships once."
  );

  // Non-interactive: apply an LLM-produced JSON draft from a file or stdin.
  const useStdin = hasFlag("--stdin");
  if (hasFlag("--from-file") || useStdin) {
    // `--from-file` with no explicit path (or followed by another flag) falls
    // back to the conventional draft file, so `yarn changelog:apply` "just works".
    const flagValue = getFlagValue("--from-file");
    const draftPath =
      flagValue && !flagValue.startsWith("--") ? flagValue : DEFAULT_DRAFT_PATH;
    const rawDraft = useStdin
      ? await readStdin()
      : await readFile(draftPath, "utf8");
    let draft;
    try {
      draft = JSON.parse(rawDraft);
    } catch (error) {
      throw new Error(
        `Draft is not valid JSON: ${error.message}\n` +
          "   Common cause: an unescaped double-quote inside a description " +
          '(e.g. a "quoted" term). Replace inner " with single or curly ' +
          'quotes, or escape them as \\", then retry.'
      );
    }
    await applyDraft(changelog, draft, currentVersion);
    // Clean up the draft once it's applied so it can't be reused by mistake.
    // Only auto-remove the default draft file, and only unless --keep is set.
    if (!useStdin && draftPath === DEFAULT_DRAFT_PATH && !hasFlag("--keep")) {
      await unlink(draftPath).catch(() => {});
      console.log(`   Removed ${DEFAULT_DRAFT_PATH}`);
    }
    return;
  }

  const rl = createLineReader(input, output);

  try {
    // 1. Determine the new version.
    let newVersion = getFlagValue("--version");
    if (!newVersion) {
      if (hasFlag("--major")) newVersion = bumpVersion(currentVersion, "major");
      else if (hasFlag("--minor"))
        newVersion = bumpVersion(currentVersion, "minor");
      else if (hasFlag("--patch"))
        newVersion = bumpVersion(currentVersion, "patch");
    }

    if (!newVersion) {
      console.log(`\nCurrent version: ${currentVersion}\n`);
      console.log("Select the version bump:");
      console.log(`  1) patch  -> ${bumpVersion(currentVersion, "patch")}`);
      console.log(`  2) minor  -> ${bumpVersion(currentVersion, "minor")}`);
      console.log(`  3) major  -> ${bumpVersion(currentVersion, "major")}`);
      console.log("  4) custom");
      const choice = ((await rl.question("Choice [1]: ")) ?? "").trim() || "1";
      if (choice === "1") newVersion = bumpVersion(currentVersion, "patch");
      else if (choice === "2")
        newVersion = bumpVersion(currentVersion, "minor");
      else if (choice === "3")
        newVersion = bumpVersion(currentVersion, "major");
      else if (choice === "4") {
        newVersion = (
          (await rl.question("Enter version (x.y.z): ")) ?? ""
        ).trim();
      } else {
        throw new Error(`Invalid choice: ${choice}`);
      }
    }

    if (!isValidVersion(newVersion)) {
      throw new Error(`Invalid version: "${newVersion}" (expected x.y.z)`);
    }
    newVersion = newVersion.trim();

    // 2. Collect change entries.
    console.log(`\nAdding changes for v${newVersion}. Leave the description`);
    console.log("blank to finish.\n");

    const changes = [];
    for (;;) {
      const raw = await rl.question(
        `Change #${changes.length + 1} description: `
      );
      if (raw === null) {
        if (changes.length) break;
        throw new Error("Aborted: at least one change is required.");
      }
      const description = raw.trim();
      if (!description) {
        if (changes.length) break;
        console.log("At least one change is required. Try again.\n");
        continue;
      }

      const typeInput = (
        (await rl.question(
          "  Type [a]dded/[c]hanged/[f]ixed/[r]emoved (a): "
        )) ?? ""
      )
        .trim()
        .toLowerCase();
      const type = CHANGE_TYPES.find((t) => t.startsWith(typeInput)) || "added";

      changes.push({ type, description });
      console.log(`  ✓ [${type}] ${description}\n`);
    }

    // 3. Persist the release (shared with the draft/LLM path).
    await writeRelease(changelog, { version: newVersion, changes });
  } finally {
    rl.close();
  }
}

function compareVersionsDesc(a, b) {
  const pa = parseVersion(a);
  const pb = parseVersion(b);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const diff = (pb[i] || 0) - (pa[i] || 0);
    if (diff !== 0) return diff < 0 ? -1 : 1;
  }
  return 0;
}

// Run only when executed directly, so the entry helpers can be imported.
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(`\n❌ ${error.message}\n`);
    process.exit(1);
  });
}
