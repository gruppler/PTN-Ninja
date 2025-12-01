import store from "./store";
import { auth, db, functions } from "./boot/firebase.js";
import { i18n } from "./boot/i18n";
import Ply from "./Game/PTN/Ply";
import { toDate } from "date-fns";
import { omit } from "lodash";
import { isArray, isFunction, isObject, isString } from "lodash";
import Vue from "vue";
import { Dialog, Notify } from "quasar";

let parent = window.parent || window.opener;
try {
  if (parent === window || window.origin === parent.origin) {
    parent = null;
  }
} catch (error) {}

export function postMessage(action, value) {
  if (parent) {
    parent.postMessage({ action, value }, "*");
  }
}

export const call = async (functionName, data) => {
  let response = await functions.httpsCallable(functionName)(data);
  if ("data" in response) {
    response = response.data;
  } else if ("result" in response) {
    response = response.result;
  }
  if (response && response.errorInfo) {
    throw response.errorInfo;
  } else {
    return response;
  }
};

export function deepFreeze(object) {
  const keys = Object.getOwnPropertyNames(object);

  for (const key of keys) {
    const value = object[key];

    if (value && isObject(value) && !Object.isFrozen(object)) {
      deepFreeze(value);
    }
  }

  return Object.freeze(object);
}

export function countedThrottle(func, wait) {
  let lastTime = 0;
  let count = 0;
  let timer = null;
  return function (...args) {
    const now = Date.now();
    count++;
    if (now - lastTime >= wait) {
      lastTime = now;
      func(count, ...args);
      count = 0;
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
    } else if (!timer) {
      timer = setTimeout(() => {
        lastTime = now;
        func(count, ...args);
        count = 0;
        timer = null;
      }, wait - (now - lastTime));
    }
  };
}

function nextPly(player, color) {
  if (player === 2 && color === 1) {
    return { player: 1, color: 1 };
  }
  return { player: player === 1 ? 2 : 1, color: color === 1 ? 2 : 1 };
}

export function parsePV(player, color, pv) {
  return pv.map((ply, i) => {
    if (i) {
      ({ player, color } = nextPly(player, color));
    }
    return new Ply(ply, { id: null, player, color });
  });
}

export const prompt = ({
  title,
  message,
  prompt,
  ok,
  cancel,
  success,
  failure,
}) => {
  let dialog = Dialog.create({
    title,
    message,
    prompt,
    color: "primary",
    "no-backdrop-dismiss": true,
    ok: {
      label: ok || i18n.t("OK"),
      flat: true,
      color: "primary",
    },
    cancel: {
      label: cancel || i18n.t("Cancel"),
      flat: true,
      color: "primary",
    },
    class: "bg-ui non-selectable",
  });
  if (success) {
    dialog.onOk(success);
  }
  if (failure) {
    dialog.onCancel(failure);
  }
  return dialog;
};

//#region Notifications

export const notify = (message, options) => {
  if (isObject(message)) {
    options = message;
    message = options.message;
  }
  let fg = store.state.ui.theme.isDark ? "textLight" : "textDark";
  let bg = "ui";
  if (options.invert) {
    [bg, fg] = [fg, bg];
  }
  if (options.actions) {
    options.actions.forEach((action) => {
      if (!action.color) {
        action.color = fg;
      }
    });
  }
  options = {
    progressClass: "bg-primary",
    color: bg,
    textColor: fg,
    position: "bottom",
    timeout: 0,
    progress: true,
    actions: [{ icon: "close", color: fg }],
    ...options,
  };
  if (message) {
    options.message = message;
  }
  return Notify.create(options);
};

export const notifyError = (error, options = {}) => {
  if (options.actions) {
    options.actions.forEach((action) => {
      if (!action.color) {
        action.color = "text-Light";
      }
    });
  }
  Notify.create({
    message: formatError(error),
    type: "negative",
    timeout: 5e3,
    progress: true,
    position: "bottom",
    actions: [{ icon: "close", color: "textLight" }],
    ...options,
  });
};

export const notifySuccess = (success, options = {}) => {
  if (options.actions) {
    options.actions.forEach((action) => {
      if (!action.color) {
        action.color = "text-Light";
      }
    });
  }
  return Notify.create({
    message: formatSuccess(success),
    type: "positive",
    timeout: 5e3,
    progress: true,
    position: "bottom",
    actions: [{ icon: "close", color: "textLight" }],
    ...options,
  });
};

export const notifyWarning = (warning, options = {}) => {
  if (options.actions) {
    options.actions.forEach((action) => {
      if (!action.color) {
        action.color = "text-Dark";
      }
    });
  }
  return Notify.create({
    message: formatWarning(warning),
    type: "warning",
    icon: "warning",
    timeout: 5e3,
    progress: true,
    position: "bottom",
    actions: [{ icon: "close", color: "textDark" }],
    ...options,
  });
};

export const notifyHint = (hint, options = {}) => {
  if (options.actions) {
    options.actions.forEach((action) => {
      if (!action.color) {
        action.color = "text-Light";
      }
    });
  }
  return Notify.create({
    message: formatHint(hint),
    type: "info",
    timeout: 5e3,
    progress: true,
    position: "bottom",
    actions: [{ icon: "close", color: "textLight" }],
    ...options,
  });
};

export const formatError = (error) => {
  if (isString(error)) {
    if (i18n.te(`error["${error}"]`)) {
      return i18n.t(`error["${error}"]`);
    } else {
      return error;
    }
  } else {
    if (i18n.te(`error["${error.code}"]`)) {
      return i18n.t(`error["${error.code}"]`);
    } else if ("message" in error) {
      if (i18n.te(`error["${error.message}"]`)) {
        return i18n.t(`error["${error.message}"]`);
      } else {
        return error.message;
      }
    }
  }
};

export const formatSuccess = (success) => {
  if (isString(success)) {
    if (i18n.te(`success["${success}"]`)) {
      return i18n.t(`success["${success}"]`);
    } else {
      return success;
    }
  }
};

export const formatWarning = (warning) => {
  if (isString(warning)) {
    if (i18n.te(`warning["${warning}"]`)) {
      return i18n.t(`warning["${warning}"]`);
    } else {
      return warning;
    }
  } else {
    if (i18n.te(`warning["${warning.code}"]`)) {
      return i18n.t(`warning["${warning.code}"]`);
    } else if ("message" in warning) {
      if (i18n.te(`warning["${warning.message}"]`)) {
        return i18n.t(`warning["${warning.message}"]`);
      } else {
        return warning.message;
      }
    }
  }
};

export const formatHint = (hint) => {
  if (isString(hint)) {
    if (i18n.te(`hint["${hint}"]`)) {
      return i18n.t(`hint["${hint}"]`);
    } else {
      return hint;
    }
  }
};

//#region Online Games

export const gameConverter = {
  toFirestore(game) {
    // Convert Game object to Firestore document format
    // Note: Branches are stored in a subcollection, not in the main document
    const data = {
      name: game.name || "",
      config: omit(game.jsonConfig, [
        "id",
        "collection",
        "path",
        "isOnline",
        "player",
      ]),
      tags: game.jsonTags,
      state: game.jsonState,
      notes: game.jsonNotes || [],
    };

    // Add metadata if available
    if (game.createdBy) data.createdBy = game.createdBy;
    if (game.createdAt) data.createdAt = game.createdAt;
    if (game.updatedBy) data.updatedBy = game.updatedBy;
    if (game.updatedAt) data.updatedAt = game.updatedAt;

    return data;
  },
  fromFirestore(snapshot, options) {
    // Convert Firestore document to Game-compatible data
    const data = snapshot.data(options);

    // Add online-specific config
    data.config = data.config || {};
    data.config.isOnline = true;
    data.config.id = snapshot.id;
    data.config.collection = snapshot.ref.parent.id;
    data.config.path = snapshot.ref.path;

    // Convert players object back to array if needed
    // Firestore stores sparse arrays (with nulls) as objects
    if (data.config.players && !Array.isArray(data.config.players)) {
      const playersObj = data.config.players;
      data.config.players = [playersObj[0] || null, playersObj[1] || null];
    }

    data.config.player =
      data.config.players && auth.currentUser
        ? data.config.players.indexOf(auth.currentUser.uid) + 1
        : 0;
    data.config.size = (data.tags && data.tags.size) || 6;

    // Convert timestamps
    if (data.tags && data.tags.date) {
      data.tags.date = timestampToDate(data.tags.date);
    }
    if (data.createdAt) {
      data.createdAt = timestampToDate(data.createdAt);
    }
    if (data.updatedAt) {
      data.updatedAt = timestampToDate(data.updatedAt);
    }

    // Note: Branches are loaded separately via LISTEN_CURRENT_GAME
    // They are not included in the main game document

    return data;
  },
};

export const branchConverter = {
  toFirestore(branch) {
    // Convert branch data to Firestore format
    return {
      parent: branch.parent || null,
      name: branch.name || "",
      player: branch.player || 1,
      plies: branch.plies || [],
      uid: branch.uid || null,
      createdAt: branch.createdAt || new Date(),
      updatedAt: branch.updatedAt || new Date(),
    };
  },
  fromFirestore(snapshot, options) {
    // Convert Firestore branch document to usable format
    const data = snapshot.data(options);

    // Convert timestamps
    if (data.createdAt) {
      data.createdAt = timestampToDate(data.createdAt);
    }
    if (data.updatedAt) {
      data.updatedAt = timestampToDate(data.updatedAt);
    }

    // Add document ID
    data.id = snapshot.id;
    data.path = snapshot.ref.path;

    return data;
  },
  getStateID(path) {
    // Extract branch ID from path for state management
    // Path format: gamesPublic/{gameID}/branches/{branchID}
    const parts = path.split("/");
    return parts[parts.length - 1];
  },
};

export const analysisConverter = {
  toFirestore(analysis) {
    // Convert analysis to Firestore format
    return {
      gameID: analysis.gameID || "",
      title: analysis.title || "",
      tags: analysis.tags || [],
      uid: analysis.uid || null,
      createdAt: analysis.createdAt || new Date(),
      updatedAt: analysis.updatedAt || new Date(),
    };
  },
  fromFirestore(snapshot, options) {
    const data = snapshot.data(options);

    // Convert timestamps
    if (data.createdAt) {
      data.createdAt = timestampToDate(data.createdAt);
    }
    if (data.updatedAt) {
      data.updatedAt = timestampToDate(data.updatedAt);
    }

    // Add document ID
    data.id = snapshot.id;
    data.path = snapshot.ref.path;

    return data;
  },
};

export const puzzleConverter = {
  toFirestore(puzzle) {
    // Convert puzzle to Firestore format
    return {
      name: puzzle.name || "",
      type: puzzle.type || "",
      tags: puzzle.tags || [],
      uid: puzzle.uid || null,
      createdAt: puzzle.createdAt || new Date(),
      updatedAt: puzzle.updatedAt || new Date(),
    };
  },
  fromFirestore(snapshot, options) {
    const data = snapshot.data(options);

    // Convert timestamps
    if (data.createdAt) {
      data.createdAt = timestampToDate(data.createdAt);
    }
    if (data.updatedAt) {
      data.updatedAt = timestampToDate(data.updatedAt);
    }

    // Add document ID
    data.id = snapshot.id;
    data.path = snapshot.ref.path;

    return data;
  },
};

export const commentConverter = {
  toFirestore(comment) {
    // Convert comment to Firestore format
    return {
      text: comment.text || "",
      replyTo: comment.replyTo || null,
      uid: comment.uid || null,
      createdAt: comment.createdAt || new Date(),
      updatedAt: comment.updatedAt || new Date(),
    };
  },
  fromFirestore(snapshot, options) {
    const data = snapshot.data(options);

    // Convert timestamps
    if (data.createdAt) {
      data.createdAt = timestampToDate(data.createdAt);
    }
    if (data.updatedAt) {
      data.updatedAt = timestampToDate(data.updatedAt);
    }

    // Add document ID
    data.id = snapshot.id;
    data.path = snapshot.ref.path;

    return data;
  },
};

export const timestampToDate = (date) => {
  if (date && date.constructor !== Date) {
    if (date.toDate) {
      date = date.toDate(date);
    } else if (date instanceof Object && "_nanoseconds" in date) {
      date = new Date(date._seconds * 1e3 + date._nanoseconds / 1e6);
    } else {
      date = new Date(date);
      if (isNaN(date)) {
        date = toDate(date);
      }
    }
  }
  return date;
};

export const SET = (state, { stateKey, stateID, doc }) => {
  Vue.set(state[stateKey], stateID || doc.stateID || doc.id, deepFreeze(doc));
};

export const REMOVE = (state, { stateKey, stateID, id }) => {
  Vue.delete(state[stateKey], stateID || id);
};

export const LISTEN = (state, { path, unsubscribe, next, error }) => {
  const previous = state.listeners[path];
  if (previous) {
    const listener = { ...previous };
    if (isFunction(unsubscribe)) {
      if (isFunction(previous.unsubscribe)) {
        listener.unsubscribe = () => {
          unsubscribe();
          previous.unsubscribe();
        };
      } else {
        listener.unsubscribe = unsubscribe;
      }
    }
    if (isFunction(next)) {
      if (isFunction(previous.next)) {
        listener.next = (data) => {
          next(data);
          previous.next(data);
        };
      } else {
        listener.next = next;
      }
    }
    if (isFunction(error)) {
      if (isFunction(previous.error)) {
        listener.error = (message) => {
          error(message);
          previous.error(message);
        };
      } else {
        listener.error = error;
      }
    }
    state.listeners[path] = Object.freeze(listener);
  } else {
    state.listeners[path] = Object.freeze({ unsubscribe, next, error });
  }
};

export const UNLISTEN = (state, path) => {
  delete state.listeners[path];
};

export const LISTEN_DOC = function (
  { commit, dispatch, state },
  { converter, path, stateKey, id, next, error, unlisten }
) {
  if (state.listeners[path]) {
    if (unlisten) {
      dispatch("UNLISTEN", path);
    } else {
      let stateID = id;
      if (isFunction(next) || isFunction(error)) {
        commit("LISTEN", { path, next, error });
        if (state[stateKey][stateID] && isFunction(next)) {
          next(state[stateKey][stateID]);
        }
      }
      return false;
    }
  }

  const unsubscribe = db
    .doc(path)
    .withConverter(converter)
    .onSnapshot({
      next: (snapshot) => {
        let doc = null;
        let stateID = snapshot.id;
        if (snapshot.exists) {
          doc = snapshot.data();
          commit("SET", { stateKey, stateID, doc });
        } else {
          commit("REMOVE", { stateKey, stateID });
        }
        if (isFunction(state.listeners[path].next)) {
          state.listeners[path].next(doc);
        }
      },
      error: (error) => {
        if (isFunction(state.listeners[path].error)) {
          state.listeners[path].error(error);
        }
      },
    });

  commit("LISTEN", { path, unsubscribe, next, error });
  return path;
};

export const LISTEN_COLLECTION = function (
  { commit, dispatch, state },
  {
    converter,
    path,
    collectionGroup,
    listenerPath,
    stateKey,
    where,
    limit,
    pagination,
    next,
    error,
    unlisten,
  }
) {
  if (!listenerPath) {
    listenerPath = path || collectionGroup;
  }

  if (state.listeners[listenerPath]) {
    if (unlisten) {
      dispatch("UNLISTEN", listenerPath);
    } else {
      if (isFunction(next) || isFunction(error)) {
        commit("LISTEN", { path: listenerPath, next, error });
        if (isFunction(next) && Object.keys(state[stateKey]).length) {
          next(state[stateKey]);
        }
      }
      return false;
    }
  }

  let query;
  if (collectionGroup) {
    query = db.collectionGroup(collectionGroup);
  } else {
    query = db.collection(path);
  }
  query = query.withConverter(converter);

  if (where && where.length) {
    if (isArray(where[0])) {
      where.forEach((condition) => (query = query.where(...condition)));
    } else {
      query = query.where(...where);
    }
  }

  if (limit) {
    query = query.limit(limit);
  }

  if (pagination) {
    query = query.orderBy(
      pagination.sortBy,
      pagination.descending ? "desc" : "asc"
    );
  }

  const unsubscribe = query.onSnapshot({
    next: (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        let stateID = change.doc.id;
        if (isFunction(converter.getStateID)) {
          stateID = converter.getStateID(change.doc.ref.path);
        }
        if (change.type === "removed") {
          commit("REMOVE", { stateKey, stateID });
        } else {
          commit("SET", { stateKey, stateID, doc: change.doc.data() });
        }
      });
      if (isFunction(state.listeners[listenerPath].next)) {
        state.listeners[listenerPath].next(state[stateKey]);
      }
    },
    error: (error) => {
      if (isFunction(state.listeners[listenerPath].error)) {
        state.listeners[listenerPath].error(error);
      }
    },
  });

  commit("LISTEN", { path: listenerPath, unsubscribe, error, next });
  return listenerPath;
};
