import { openDB } from "idb";
import { LocalStorage } from "quasar";
import Game from "../../Game";
import { notifyError } from "../../utilities";
import { uniq } from "lodash";

const VERSION = 1;

export const openLocalDB = async () => {
  if (!("indexedDB" in window)) {
    throw new Error("Database not supported");
  }

  const db = await openDB("games", VERSION, {
    upgrade: async (db, oldVersion) => {
      if (!oldVersion) {
        // Initialize
        const metaStore = db.createObjectStore("meta", { keyPath: "name" });
        const ptnStore = db.createObjectStore("ptn", { keyPath: "name" });
        const historyStore = db.createObjectStore("history", {
          keyPath: "name",
        });

        // Create indices
        metaStore.createIndex("lastSeen", "lastSeen");
        metaStore.createIndex("size", "config.size");
        metaStore.createIndex("isOnline", "config.isOnline");

        // Move games from LocalStorage to IndexedDB

        const load = (key, initial) =>
          LocalStorage.has(key) ? LocalStorage.getItem(key) : initial;
        const now = new Date().getTime();
        await Promise.all(
          uniq(LocalStorage.getItem("games")).map(async (name, i) => {
            const ptn = load("ptn-" + name);
            let state = load("state-" + name);
            if (ptn && (!state || !state.tps || !("ply" in state))) {
              // Backward compatibility
              try {
                state = new Game({ ptn, state }).minState;
              } catch (error) {
                console.error("Error parsing " + name, error);
              }
            }
            metaStore.add({
              name,
              config: load("config-" + name, {}),
              state,
              editingTPS: load("editingTPS-" + name),
              lastSeen: new Date(now + i),
            });
            ptnStore.add({ name, ptn });
            historyStore.add({
              name,
              states: load("history-" + name, []),
              index: load("historyIndex-" + name, 0),
            });
          })
        );
      }
    },
  });

  db.onerror = (event) => notifyError(event.target.error);

  db.onversionchange = () => {
    db.close();
    notifyError("Database outdated");
  };

  return db;
};
