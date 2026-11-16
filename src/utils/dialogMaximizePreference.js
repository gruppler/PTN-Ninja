// Whether each dialog was last maximized or restored by hand, kept per
// dialog (its component's name). null means it follows the screen size.
import { LocalStorage } from "quasar";

const STORAGE_PREFIX = "dialogMaximized:";

function storageKey(key) {
  return key ? STORAGE_PREFIX + key : null;
}

export function loadMaximizedPreference(key) {
  const k = storageKey(key);
  if (!k || !LocalStorage.has(k)) return null;
  const value = LocalStorage.getItem(k);
  return typeof value === "boolean" ? value : null;
}

export function saveMaximizedPreference(key, value) {
  const k = storageKey(key);
  if (!k) return;
  try {
    if (value === null || value === undefined) {
      LocalStorage.remove(k);
    } else {
      LocalStorage.set(k, Boolean(value));
    }
  } catch (error) {
    // Storage full or unavailable: the choice holds until the page closes
  }
}
