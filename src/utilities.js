import store from "./store";
import { i18n } from "./boot/i18n";
import Ply from "./Game/PTN/Ply";
import { toDate } from "date-fns";
import { isString, isObject } from "lodash";
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
