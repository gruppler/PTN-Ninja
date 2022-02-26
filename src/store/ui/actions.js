import Vue from "vue";
import {
  copyToClipboard,
  exportFile,
  Loading,
  LocalStorage,
  Dialog,
  Notify,
} from "quasar";
import {
  prompt,
  notify,
  notifyError,
  notifySuccess,
  notifyWarning,
  notifyHint,
} from "../../utilities";
import { THEMES } from "../../themes";
import { i18n } from "../../boot/i18n";
import { isArray, isFunction, isString } from "lodash";

export const SET_THEME = ({ state, getters, commit }, theme) => {
  if (isString(theme)) {
    theme = getters.theme(theme);
  }
  if (!theme) {
    theme = getters.theme() || THEMES.find((t) => t.id === "classic");
  }
  if (!state.embed) {
    LocalStorage.set("theme", theme);
  }
  commit("SET_THEME", theme);
};

export const SET_UI = ({ state, commit, dispatch }, [key, value]) => {
  if (key in state.defaults) {
    if (!state.embed) {
      LocalStorage.set(key, value);
    }
    commit("SET_UI", [key, value]);
    if (key === "themeID" || key === "theme") {
      dispatch("SET_THEME", value);
    }
  }
};

export const TOGGLE_UI = ({ state, commit }, key) => {
  if (key in state.defaults) {
    if (!state.embed) {
      LocalStorage.set(key, !state[key]);
    }
    commit("SET_UI", [key, !state[key]]);
  }
};

export const PROMPT = (context, options) => {
  return prompt(options);
};

export const NOTIFY = ({ state }, options) => {
  return notify(options);
};

export const NOTIFY_ERROR = (context, error) => {
  return notifyError(error);
};

export const NOTIFY_SUCCESS = (context, success) => {
  return notifySuccess(success);
};

export const NOTIFY_WARNING = (context, warning) => {
  return notifyWarning(warning);
};

export const NOTIFY_HINT = (context, hint) => {
  return Notify.create({
    message: formatHint(hint),
    type: "info",
    timeout: 0,
    position: "top-right",
    multiLine: false,
    actions: [{ icon: "close", color: "textLight" }],
  });
};

export const WITHOUT_BOARD_ANIM = ({ commit, state }, action) => {
  if (state.animateBoard) {
    commit("SET_UI", ["animateBoard", false]);
    Vue.nextTick(async () => {
      await action();
      Vue.nextTick(() => {
        commit("SET_UI", ["animateBoard", true]);
      });
    });
  } else {
    action();
  }
};

export const EXPORT_PTN = ({ dispatch }, games) => {
  if (!games) {
    games = [Vue.prototype.$game];
  } else if (!isArray(games)) {
    games = [games];
  }

  return dispatch(
    "DOWNLOAD_FILES",
    games.map(
      (game) =>
        new File([game.ptn], game.name + ".ptn", {
          type: "text/plain",
        })
    )
  );
};

export const OPEN = function (context, callback) {
  let input = document.createElement("INPUT");
  input.type = "file";
  input.accept = ".ptn,.txt";
  input.multiple = true;
  input.hidden = true;
  input.addEventListener("input", (event) => {
    this.dispatch("game/OPEN_FILES", event.target.files);
    if (callback && isFunction(callback)) {
      callback();
    }
  });
  input.click();
};

export const DOWNLOAD_FILES = ({ dispatch, getters }, files) => {
  if (!isArray(files)) {
    files = [files];
  }

  let success = true;
  files.forEach((file) => {
    success &= exportFile(file.name, file);
  });

  if (!success) {
    dispatch("NOTIFY_ERROR", "Unable to download");
  }
};

export const COPY = function ({ dispatch, state }, { text, title }) {
  return copyToClipboard(text)
    .then(() => {
      dispatch("NOTIFY", {
        icon: "copy",
        message: i18n.t(title ? "success.copiedItem" : "success.copied", {
          item: title,
        }),
        timeout: 1000,
      });
    })
    .catch(() => {
      Dialog.create({
        class: "bg-ui",
        color: "primary",
        prompt: {
          model: text,
          filled: true,
          type: text && text.includes("\n") ? "textarea" : "text",
        },
        cancel: false,
      });
    });
};

export const SHARE = function ({ dispatch, state }, { text, title }) {
  if (state.nativeSharing) {
    navigator.share({ text, title }).catch((error) => {
      console.error(error);
      if (!/canceled|abort/i.test(error)) {
        dispatch("COPY", { text, title });
      }
    });
  } else {
    dispatch("COPY", { text, title });
  }
};

export const RESET_TRANSFORM = ({ dispatch }) => {
  dispatch("SET_UI", ["boardTransform", [0, 0]]);
};

export const ROTATE_180 = ({ dispatch, state }) => {
  const t = state.boardTransform;
  dispatch("SET_UI", ["boardTransform", [(t[0] + 2) % 4, t[1]]]);
};

export const ROTATE_LEFT = ({ dispatch, state }) => {
  const t = state.boardTransform;
  dispatch("SET_UI", ["boardTransform", [(t[0] + 3 - 2 * t[1]) % 4, t[1]]]);
};

export const ROTATE_RIGHT = ({ dispatch, state }) => {
  const t = state.boardTransform;
  dispatch("SET_UI", ["boardTransform", [(t[0] + 1 + 2 * t[1]) % 4, t[1]]]);
};

export const FLIP_HORIZONTAL = ({ dispatch, state }) => {
  const t = state.boardTransform;
  dispatch("SET_UI", ["boardTransform", [t[0], t[1] ^ 1]]);
};

export const FLIP_VERTICAL = ({ dispatch, state }) => {
  const t = state.boardTransform;
  dispatch("SET_UI", ["boardTransform", [(t[0] + 2) % 4, t[1] ^ 1]]);
};
