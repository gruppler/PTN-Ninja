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
        const store = db.createObjectStore("games", { keyPath: "name" });

        // Create indices
        store.createIndex("lastSeen", "lastSeen");
        store.createIndex("isOnline", "config.isOnline");

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
            await store.add({
              name,
              ptn,
              state,
              config: load("config-" + name, {}),
              editingTPS: load("editingTPS-" + name),
              history: load("history-" + name, []),
              historyIndex: load("historyIndex-" + name, 0),
              lastSeen: new Date(now - i),
            });
            LocalStorage.remove("ptn-" + name);
            LocalStorage.remove("state-" + name);
            LocalStorage.remove("config-" + name);
            LocalStorage.remove("editingTPS-" + name);
            LocalStorage.remove("history-" + name);
            LocalStorage.remove("historyIndex-" + name);
          })
        );
        LocalStorage.remove("games");
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
