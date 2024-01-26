import store from "./store";
import { db, functions } from "./boot/firebase.js";
import { i18n } from "./boot/i18n";
import { toDate } from "date-fns";
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

export const notify = (options) => {
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
  return Notify.create({
    progressClass: "bg-primary",
    color: bg,
    textColor: fg,
    position: "bottom",
    timeout: 0,
    actions: [{ icon: "close", color: fg }],
    ...options,
  });
};

export const notifyError = (error) => {
  Notify.create({
    message: formatError(error),
    type: "negative",
    timeout: 0,
    position: "bottom",
    actions: [{ icon: "close", color: "textLight" }],
  });
};

export const notifySuccess = (success) => {
  return Notify.create({
    message: formatSuccess(success),
    type: "positive",
    timeout: 0,
    position: "top-right",
    multiLine: false,
    actions: [{ icon: "close", color: "textLight" }],
  });
};

export const notifyWarning = (warning) => {
  return Notify.create({
    message: formatWarning(warning),
    type: "warning",
    icon: "warning",
    timeout: 0,
    position: "top-right",
    multiLine: false,
    actions: [{ icon: "close", color: "textDark" }],
  });
};

export const notifyHint = (hint) => {
  return Notify.create({
    message: formatHint(hint),
    type: "info",
    timeout: 0,
    position: "top-right",
    multiLine: false,
    actions: [{ icon: "close", color: "textLight" }],
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
