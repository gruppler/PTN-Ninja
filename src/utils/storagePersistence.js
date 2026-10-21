/*
 * Asks the browser not to evict our IndexedDB games database.
 *
 * Without persistence, games live in the "best-effort" bucket:
 *   - Chrome evicts least-recently-used origins under disk pressure, but also
 *     auto-grants persistence based on engagement (installed as a PWA,
 *     bookmarked, high site engagement), and never prompts.
 *   - Firefox evicts under pressure, and prompts the user on request.
 *   - WebKit clears script-writable storage after 7 days without interaction,
 *     regardless of pressure. Home-Screen-installed apps are exempt.
 *
 * The browser owns the decision and remembers it, so there is nothing to
 * configure in the app. We only choose *when* to ask: once the user has a game
 * worth keeping, rather than during load, since a permission prompt fired
 * before the user has done anything tends to get dismissed reflexively.
 */

let requested = false;

const isSupported = () =>
  typeof navigator !== "undefined" &&
  !!navigator.storage &&
  typeof navigator.storage.persist === "function" &&
  typeof navigator.storage.persisted === "function";

/*
 * Request persistent storage unless it is already granted. Safe to call from
 * anywhere a game is saved; it does nothing after the first call, and resolves
 * to null when the browser has no StorageManager.
 */
export const ensureStoragePersistence = async () => {
  if (requested || !isSupported()) {
    return null;
  }
  requested = true;

  try {
    if (await navigator.storage.persisted()) {
      return true;
    }
    return await navigator.storage.persist();
  } catch (error) {
    console.error("Error requesting storage persistence", error);
    return null;
  }
};
