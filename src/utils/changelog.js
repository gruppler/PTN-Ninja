import changelog from "../changelog.json";

// Current app version, injected at build time from package.json via
// quasar.conf.js (buildEnv.APP_VERSION). Falls back to INITIAL_VERSION so the app
// never crashes if the env var is somehow missing.
export const INITIAL_VERSION = "3.5.5";
export const APP_VERSION = process.env.APP_VERSION || INITIAL_VERSION;

// Visual metadata for each change type (icon + Quasar color), keyed by the
// `type` field stored on each change entry. Mirrors the Keep a Changelog
// vocabulary.
export const CHANGE_TYPES = {
  added: { label: "Added", icon: "add" },
  changed: { label: "Changed", icon: "edit" },
  fixed: { label: "Fixed", icon: "bug" },
  removed: { label: "Removed", icon: "delete" },
};

// Parse a dotted version string ("1.2.3") into a numeric array. Non-numeric
// segments become 0 so comparisons never throw.
export function parseVersion(version) {
  return String(version || "0")
    .split(".")
    .map((segment) => parseInt(segment, 10) || 0);
}

// Compare two version strings. Returns -1 if a < b, 1 if a > b, 0 if equal.
export function compareVersions(a, b) {
  const pa = parseVersion(a);
  const pb = parseVersion(b);
  const length = Math.max(pa.length, pb.length);
  for (let i = 0; i < length; i++) {
    const diff = (pa[i] || 0) - (pb[i] || 0);
    if (diff !== 0) {
      return diff < 0 ? -1 : 1;
    }
  }
  return 0;
}

// True when `version` is strictly newer than `sinceVersion`. A missing
// `sinceVersion` (first-ever load) treats every release as new.
export function isVersionNewerThan(version, sinceVersion) {
  if (!sinceVersion) return true;
  return compareVersions(version, sinceVersion) > 0;
}

// All releases, newest first, defensively normalized.
export function getReleases() {
  const releases = (changelog && changelog.releases) || [];
  return [...releases].sort((a, b) => compareVersions(b.version, a.version));
}

// Callers read this out of localStorage, whose getItem returns null for a
// missing key rather than throwing. A default parameter only fills in for
// undefined, so that null reached isVersionNewerThan, which reads a falsy
// `sinceVersion` as "never seen anything" and marked every release new — the
// whole history under "New since your last update" on a first load. Anything
// falsy means no record, which INITIAL_VERSION is the floor for.
function resolveLastSeenVersion(lastSeenVersion) {
  return lastSeenVersion || INITIAL_VERSION;
}

// Build the changelog, annotating each release with `isNew` (unseen relative
// to `lastSeenVersion`).
export function getChangelog({ lastSeenVersion } = {}) {
  const since = resolveLastSeenVersion(lastSeenVersion);
  return getReleases().map((release) => ({
    ...release,
    isNew: isVersionNewerThan(release.version, since),
  }));
}

// True when there is at least one unseen release. Drives the auto-open dialog
// and the menu badge.
export function hasUnseenChanges({ lastSeenVersion } = {}) {
  return getChangelog({ lastSeenVersion }).some((release) => release.isNew);
}
