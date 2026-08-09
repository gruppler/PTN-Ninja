import changelog from "../changelog.json";

// Current app version, injected at build time from package.json via
// quasar.conf.js (buildEnv.APP_VERSION). Falls back to "0.0.0" so the app
// never crashes if the env var is somehow missing.
export const APP_VERSION = process.env.APP_VERSION || "0.0.0";

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

// Build the changelog, annotating each release with `isNew` (unseen relative
// to `lastSeenVersion`).
export function getChangelog({ lastSeenVersion = null } = {}) {
  return getReleases().map((release) => ({
    ...release,
    isNew: isVersionNewerThan(release.version, lastSeenVersion),
  }));
}

// True when there is at least one unseen release. Drives the auto-open dialog
// and the menu badge.
export function hasUnseenChanges({ lastSeenVersion = null } = {}) {
  return getChangelog({ lastSeenVersion }).some((release) => release.isNew);
}
