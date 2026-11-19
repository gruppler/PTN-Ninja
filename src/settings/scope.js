/**
 * Where setting rows read and write their values.
 *
 * SettingRow and SettingsSection take a scope from `inject: settingsScope`,
 * falling back to the store's. A scope is
 * {
 *   hotkeys       whether rows show their hotkey
 *   rootState()   the state that entries' values and rules read, shaped as
 *                 the Vuex root state ({ ui, analysis, … })
 *   disabledOptions()  the keys the game disables, or null
 *   byId(id), childrenOf(id), entriesIn(category, section, ids)
 *                 the entries the rows show, as the registry's functions
 *   set(entry, value)
 * }
 */

import Vue from "vue";
import { SETTINGS, byId, childrenOf, entriesIn, setValue } from "./registry";

/** The live settings, read from and written to the store */
export const storeScope = (store) => ({
  hotkeys: true,
  rootState: () => store.state,
  disabledOptions: () => store.getters["game/disabledOptions"],
  byId,
  childrenOf,
  entriesIn,
  set: (entry, value) => setValue(store.dispatch, entry, value),
});

/** An entry a scope adds to the registry's: "<store>:<key>", a toggle unless it says otherwise */
export const localEntry = (id, fields) => {
  const [store, key] = id.split(":");
  return { id, store, key, control: "toggle", ...fields };
};

/**
 * Rows that edit a config object of a dialog's own instead of the store.
 *
 * - state()    the root-state view of the config, e.g. { ui: config }.
 *              Writes go into these objects.
 * - ids        the registry entries offered, in any order; the rows keep
 *              the registry's order
 * - overrides  { id: fields } laid over a registry entry, e.g. its own
 *              disabledWhen and disabledHint (dependsOn: undefined drops
 *              its parent)
 * - local      entries of the dialog's own. One whose dependsOn is an
 *              offered entry comes first among that entry's children.
 *
 * Every entry's dependsOn, as overridden, must be an offered or local entry:
 * one that isn't throws, naming the entry and its parent.
 */
export const configScope = ({ state, ids, overrides = {}, local = [] }) => {
  const entries = [];
  SETTINGS.forEach((entry) => {
    if (ids.includes(entry.id)) {
      entries.push(
        overrides[entry.id] ? { ...entry, ...overrides[entry.id] } : entry
      );
      entries.push(...local.filter((l) => l.dependsOn === entry.id));
    }
  });
  entries.push(...local.filter((l) => !ids.includes(l.dependsOn)));
  // A row whose parent isn't offered would never be shown: a mistake in the
  // scope, which is better found as it is built
  const offered = entries.map((entry) => entry.id);
  entries.forEach(({ id, dependsOn }) => {
    if (dependsOn !== undefined && !offered.includes(dependsOn)) {
      throw new Error(
        `Setting ${id} depends on ${dependsOn}, which the scope doesn't offer`
      );
    }
  });

  const find = (id) => entries.find((entry) => entry.id === id);
  const write = (store, key, value) => Vue.set(state()[store], key, value);
  // For entries that write several values through their own `set`
  const dispatch = (action, [key, value]) => {
    if (action !== "ui/SET_UI") {
      throw new Error(`A config scope can't dispatch ${action}`);
    }
    write("ui", key, value);
  };

  return {
    hotkeys: false,
    rootState: state,
    disabledOptions: () => null,
    byId: find,
    childrenOf: (id) => entries.filter((entry) => entry.dependsOn === id),
    entriesIn: (category, section, only) =>
      entries.filter(
        (entry) =>
          entry.category === category &&
          entry.section === section &&
          !entry.dependsOn &&
          (!only || only.includes(entry.id))
      ),
    set: (entry, value) =>
      entry.set
        ? entry.set(dispatch, value)
        : write(entry.store, entry.key, value),
  };
};
