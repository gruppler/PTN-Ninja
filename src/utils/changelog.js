import Vue from "vue";
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

export const LAST_SEEN_STORAGE_KEY = "changelog.lastSeenVersion";

// getItem returns null for a missing key rather than throwing. A default
// parameter only fills in for undefined, so that null used to reach
// isVersionNewerThan, which reads a falsy `sinceVersion` as "never seen
// anything" and marked every release new. Anything falsy means no record,
// which INITIAL_VERSION is the floor for.
function resolveLastSeenVersion(lastSeenVersion) {
  return lastSeenVersion || INITIAL_VERSION;
}

// What storage says right now. Reactive, so marking a version seen clears the
// menu badge without waiting for something else to re-render.
const storedState = Vue.observable({ lastSeenVersion: null });
let storedLoaded = false;

export function getLastSeenVersion() {
  if (!storedLoaded) {
    storedLoaded = true;
    try {
      storedState.lastSeenVersion = window.localStorage.getItem(
        LAST_SEEN_STORAGE_KEY
      );
    } catch {
      storedState.lastSeenVersion = null;
    }
  }
  return resolveLastSeenVersion(storedState.lastSeenVersion);
}

// What storage said when this page loaded, held for the session.
//
// The changelog dialog marks the running version as seen the moment it opens,
// so reading storage again on a later open would collapse the "New since your
// last update" split while the user is still reading it. Pinning the value
// per page load keeps the split until a refresh, which is the point at which
// the user has genuinely moved on from the release.
let sessionLastSeenVersion = null;

export function getSessionLastSeenVersion() {
  if (sessionLastSeenVersion === null) {
    sessionLastSeenVersion = getLastSeenVersion();
  }
  return sessionLastSeenVersion;
}

// Record the running version as seen. Pins the session value first, so the
// caller that triggered this still sees the pre-update split.
export function markVersionSeen() {
  getSessionLastSeenVersion();
  storedState.lastSeenVersion = APP_VERSION;
  try {
    window.localStorage.setItem(LAST_SEEN_STORAGE_KEY, APP_VERSION);
  } catch {
    // Ignore: storage is a nicety, not critical.
  }
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
