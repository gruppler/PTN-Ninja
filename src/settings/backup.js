/**
 * Settings export and import.
 *
 * An export is a snapshot of the stored settings, not of the store: the
 * values exactly as LocalStorage holds them, under the registry's
 * "<store>:<key>" IDs (the same IDs account sync will use). Importing writes
 * them back to LocalStorage and reloads, so the store loads them the way it
 * loads any device's settings, through every backward-compatibility step in
 * the ui and analysis state. A file made by this version therefore keeps
 * working in later ones, which upgrade it as they upgrade stored settings.
 *
 * Plain functions over a storage object ({ has, getItem, set, remove }, as
 * Quasar's LocalStorage), so they never touch Vue or the store.
 */

import { SETTINGS, UNLISTED } from "./registry";

export const FORMAT = "ptn-ninja-settings";
export const VERSION = 1;

// Kept with the settings although sync leaves them on the device: an export
// is the user's own copy, and these are choices they made
const ALSO_EXPORTED = ["analysis:botMetaOverrides", "analysis:customBots"];

/** The IDs an export holds: everything but what sync never shares */
export const BACKUP_IDS = [
  ...new Set([
    ...SETTINGS.filter(
      (entry) =>
        ["ui", "analysis"].includes(entry.store) && entry.sync !== "never"
    ).map((entry) => entry.id),
    ...Object.keys(UNLISTED).filter((id) => UNLISTED[id] !== "never"),
    ...ALSO_EXPORTED,
  ]),
].sort();

/**
 * Settings that fit the device rather than the person: how it scrolls, the
 * layout its screen suits, whether it can draw the 3D board, and the threads
 * and memory its engines get. An import only fills these in where this
 * device hasn't set them.
 */
const DEVICE_GROUPS = ["input", "layout", "board3D"];
const DEVICE_ALSO = ["analysis:botSettings"];
const syncOf = (id) => {
  const entry = SETTINGS.find((entry) => entry.id === id);
  return entry ? entry.sync : UNLISTED[id];
};
export const DEVICE_IDS = BACKUP_IDS.filter(
  (id) => DEVICE_GROUPS.includes(syncOf(id)) || DEVICE_ALSO.includes(id)
);

const keyOf = (id) => id.slice(id.indexOf(":") + 1);

/** The export of what `storage` holds, as an object ready for JSON */
export function exportSettings(storage, { appVersion } = {}) {
  const settings = {};
  BACKUP_IDS.forEach((id) => {
    const key = keyOf(id);
    if (storage.has(key)) {
      settings[id] = storage.getItem(key);
    }
  });
  return {
    format: FORMAT,
    version: VERSION,
    ...(appVersion ? { appVersion } : {}),
    exportedAt: new Date().toISOString(),
    settings,
  };
}

export class InvalidSettingsFile extends Error {}

/**
 * Parse an export (a string or an already-parsed object) and check its
 * shape. Throws InvalidSettingsFile.
 */
export function parseSettings(input) {
  let data = input;
  if (typeof input === "string") {
    try {
      data = JSON.parse(input);
    } catch (error) {
      throw new InvalidSettingsFile("Not JSON");
    }
  }
  if (
    !data ||
    typeof data !== "object" ||
    data.format !== FORMAT ||
    !Number.isInteger(data.version) ||
    data.version < 1 ||
    !data.settings ||
    typeof data.settings !== "object" ||
    Array.isArray(data.settings)
  ) {
    throw new InvalidSettingsFile("Not a settings file");
  }
  return data;
}

/**
 * A file's settings as this version holds them, where an earlier one held
 * them otherwise: Orthographic was a switch of its own, and is now a
 * perspective of 0
 */
function upgradeSettings(data) {
  if (!("ui:orthographic" in data.settings)) {
    return data;
  }
  const { "ui:orthographic": orthographic, ...settings } = data.settings;
  if (orthographic === true) {
    settings["ui:perspective"] = 0;
  }
  return { ...data, settings };
}

/**
 * Replace the stored settings with an export's. Every exported setting the
 * file leaves out goes back to its default, as it was where the file was
 * made. A device-specific setting this device has set is kept either way.
 * Settings this version doesn't know, from a later one, are skipped.
 * Returns the IDs written, those kept, and those skipped.
 */
export function importSettings(storage, input) {
  const data = upgradeSettings(parseSettings(input));
  const known = new Set(BACKUP_IDS);
  const device = new Set(DEVICE_IDS);
  const applied = [];
  const kept = [];
  const skipped = Object.keys(data.settings).filter((id) => !known.has(id));
  BACKUP_IDS.forEach((id) => {
    const key = keyOf(id);
    if (device.has(id) && storage.has(key)) {
      kept.push(id);
    } else if (id in data.settings && data.settings[id] !== undefined) {
      storage.set(key, data.settings[id]);
      applied.push(id);
    } else if (storage.has(key)) {
      storage.remove(key);
    }
  });
  return { applied, kept, skipped };
}
