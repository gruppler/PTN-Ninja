import { openDB } from "idb";
import { LocalStorage } from "quasar";
import Game from "../../Game";
import { notifyError } from "../../utilities";
import { uniq } from "lodash";

const VERSION = 2;

// Helper function to get the database key for a game
// Uses online id if available, otherwise falls back to name
export const getGameKey = (game) => {
  if (game.config && game.config.id) {
    return game.config.id;
  }
  return game.name;
};

export const openLocalDB = async () => {
  if (!("indexedDB" in window)) {
    throw new Error("Database not supported");
  }

  const db = await openDB("games", VERSION, {
    upgrade: async (db, oldVersion, newVersion, transaction) => {
      if (oldVersion === 0) {
        // Fresh install - create new schema with 'key' as keyPath
        const store = db.createObjectStore("games", { keyPath: "key" });

        // Create indices
        store.createIndex("lastSeen", "lastSeen");
        // Note: isOnline index removed because IndexedDB can't index nested properties reliably
        // We'll filter in memory instead
        store.createIndex("name", "name");

        // Move games from LocalStorage to IndexedDB
        const load = (key, initial) =>
          LocalStorage.has(key) ? LocalStorage.getItem(key) : initial;
        const now = new Date().getTime();
        await Promise.all(
          uniq(LocalStorage.getItem("games") || []).map(async (name, i) => {
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
            const config = load("config-" + name, {});
            await store.add({
              key: config.id || name,
              name,
              ptn,
              state,
              config,
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
      } else if (oldVersion === 1) {
        // Migration from version 1 to 2: change keyPath from 'name' to 'key'
        // We need to recreate the object store with the new keyPath
        const oldStore = transaction.objectStore("games");
        const allGames = await oldStore.getAll();

        // Delete old store and create new one
        db.deleteObjectStore("games");
        const newStore = db.createObjectStore("games", { keyPath: "key" });
        newStore.createIndex("lastSeen", "lastSeen");
        newStore.createIndex("name", "name");

        // Migrate data with new key
        for (const game of allGames) {
          const key = (game.config && game.config.id) || game.name;
          await newStore.add({
            ...game,
            key,
          });
        }
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
