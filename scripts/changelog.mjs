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
 *                                                   # vX.Y.Z, ff dev, push
 *   node scripts/changelog.mjs --release --dry-run  # print steps, run nothing
 *   node scripts/changelog.mjs --release --no-push  # local steps only
 *   Releases are always cut from dev; --release refuses to run elsewhere.
 *
 * Typically run via `yarn changelog`, or as part of `yarn release`
 * (`yarn changelog && yarn deploy`).
 */

import { readFile, writeFile, unlink } from "node:fs/promises";
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
function buildDraftPrompt(currentVersion, latestVersion) {
  const commits = gitCommitsSinceLastRelease(latestVersion);
  return `You are drafting a changelog release entry for "PTN Ninja".
Output ONLY a JSON object (no markdown fences, no commentary) matching this schema:

{
  "version": "x.y.z",          // REQUIRED: pick one of the suggested versions below
  "date": "${todayISO()}",       // OPTIONAL: release date (YYYY-MM-DD); defaults to today
  "changes": [
    {
      "type": "added|changed|fixed|removed",
      "description": "concise, plain-language summary"
    }
  ]
}

Rules:
- Output STRICTLY VALID JSON that JSON.parse can read. In string values (especially "description"), do NOT use raw double-quote characters — write quoted terms with single quotes (e.g. 'New Address') or curly quotes (e.g. \u201cNew Address\u201d) instead. Never leave an unescaped " inside a string.
- Set "version" explicitly (not a bump keyword). Choose the bump by IMPACT, not category: patch for fixes AND small refinements/tweaks to existing features (when in doubt, choose patch); reserve minor for substantial new capabilities a user would notice as something new; major for breaking changes.
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
function normalizeChange(raw, index) {
  const where = `changes[${index}]`;
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
// `main` (with the release's changes as the merge body), the merge commit is
// tagged `vX.Y.Z`, `dev` is fast-forwarded back to `main`, and everything is
// pushed to origin. Run from any other branch and this refuses to touch git
// history. --dry-run prints the steps without executing them; --no-push
// performs the local steps but skips the push.
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
  const unexpected = dirty.filter((path) => !RELEASE_FILES.includes(path));
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
    step(["add", ...RELEASE_FILES]);
    step(["commit", "-m", `chore(changelog): release ${tag}`]);
  } else {
    console.log(
      `  (working tree clean — assuming ${tag} is already committed)`
    );
  }

  // 2. Merge dev into main with the simplified changelog as the merge body.
  const mergeBody =
    `Release ${tag}\n\n` +
    latest.changes.map((change) => `- ${change.description}`).join("\n");
  step(["checkout", MAIN_BRANCH]);
  try {
    step([
      "merge",
      "--no-ff",
      DEV_BRANCH,
      "-m",
      `Merge branch '${DEV_BRANCH}'`,
      "-m",
      mergeBody,
    ]);
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
        "  --prompt              Print an LLM prompt (schema + recent commits)",
        "  --from-file [path]    Apply an LLM-produced JSON draft",
        "                        (defaults to ./changelog.draft.json, then deletes it)",
        "  --keep                Keep the default draft file after applying it",
        "  --stdin               Apply a JSON draft read from stdin",
        "  --set-version x.y.z   Retarget the latest release to a different",
        "                        version (syncs changelog.json + package.json)",
        "  --release             Ship the latest release: commit on dev, merge",
        "                        --no-ff into main (changelog as merge body), tag",
        "                        vX.Y.Z, fast-forward dev, and push",
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
      latest.changes.forEach((c) => {
        console.log(`  - [${c.type}] ${c.description}`);
      });
    } else {
      console.log("No releases recorded yet.");
    }
    return;
  }

  const latestVersion = changelog.releases[0] && changelog.releases[0].version;

  if (hasFlag("--prompt")) {
    console.log(buildDraftPrompt(currentVersion, latestVersion));
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

main().catch((error) => {
  console.error(`\n❌ ${error.message}\n`);
  process.exit(1);
});
