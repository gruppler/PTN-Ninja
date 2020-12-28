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
  formatError,
  formatSuccess,
  formatWarning,
  formatHint,
} from "../../utilities";
import { THEMES } from "../../themes";
import { i18n } from "../../boot/i18n";
import { isArray, isString } from "lodash";

export const SET_THEME = ({ state, getters, commit }, theme) => {
  if (isString(theme)) {
    theme = getters.theme(theme);
  }
  if (!theme) {
    theme = getters.theme() || THEMES[0];
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
    if (key === "themeID") {
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

export const PROMPT = (
  context,
  { title, message, prompt, ok, cancel, success, failure }
) => {
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

export const NOTIFY = ({ state }, options) => {
  let fg = state.theme.isDark ? "textLight" : "textDark";
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

export const NOTIFY_ERROR = (context, error) => {
  Notify.create({
    message: formatError(error),
    type: "negative",
    timeout: 0,
    position: "top-right",
    actions: [{ icon: "close", color: "textLight" }],
  });
};

export const NOTIFY_SUCCESS = (context, success) => {
  return Notify.create({
    message: formatSuccess(success),
    type: "positive",
    timeout: 0,
    position: "top-right",
    multiLine: false,
    actions: [{ icon: "close", color: "textLight" }],
  });
};

export const NOTIFY_WARNING = (context, warning) => {
  return Notify.create({
    message: formatWarning(warning),
    type: "warning",
    timeout: 0,
    position: "top-right",
    multiLine: false,
    actions: [{ icon: "close", color: "textDark" }],
  });
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
    Vue.nextTick(() => {
      action();
      Vue.nextTick(() => {
        commit("SET_UI", ["animateBoard", true]);
      });
    });
  } else {
    action();
  }
};

export const SAVE_PNG = ({ dispatch, getters, state }, game) => {
  const options = { tps: game.state.tps, ...state.pngConfig };

  // Game Tags
  ["caps", "flats", "caps1", "flats1", "caps2", "flats2"].forEach((tagName) => {
    const tag = game.tags[tagName];
    if (tag && tag.value) {
      options[tagName] = tag.value;
    }
  });

  game.render(options).toBlob((blob) => {
    dispatch(
      "DOWNLOAD_FILES",
      new File([blob], getters.png_filename(game), {
        type: "image/png",
      })
    );
  });
};

export const SAVE_PTN = ({ dispatch }, games) => {
  if (!isArray(games)) {
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

export const OPEN = ({ dispatch }, callback) => {
  let input = document.createElement("INPUT");
  input.type = "file";
  input.accept = ".ptn,.txt";
  input.multiple = true;
  input.hidden = true;
  input.addEventListener("input", (event) => {
    dispatch("OPEN_FILES", event.target.files);
    if (callback && typeof callback === "function") {
      callback();
    }
  });
  input.click();
};

export const OPEN_FILES = ({ dispatch }, files) => {
  const games = [];
  let count = 0;
  files = Array.from(files);
  if (!files.length) {
    return false;
  }
  Loading.show();
  setTimeout(
    () =>
      files.forEach((file) => {
        if (file && /\.ptn$|\.txt$/i.test(file.name)) {
          let reader = new FileReader();
          reader.onload = (event) => {
            games.push({
              name: file.name.replace(/\.ptn$|\.txt$/, ""),
              ptn: event.target.result,
            });
            if (!--count) {
              Loading.hide();
              dispatch("ADD_GAMES", { games, index: 0 });
            }
          };
          reader.onerror = (error) => console.error(error);
          ++count;
          reader.readAsText(file);
        }
      }),
    200
  );
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

export const COPY = function ({ dispatch }, { url, text, title }) {
  function copy() {
    copyToClipboard(text || url)
      .then(() => {
        dispatch("NOTIFY", {
          icon: "copy",
          message: i18n.t("success.copied"),
          timeout: 1000,
        });
      })
      .catch(() => {
        dispatch("NOTIFY_ERROR", "Unable to copy");
        Dialog.create({
          class: "bg-ui",
          color: "primary",
          prompt: {
            model: text || url,
            filled: true,
            type: text && text.includes("\n") ? "textarea" : "text",
          },
          cancel: false,
        });
      });
  }

  if (navigator.canShare) {
    navigator.share({ url, text, title }).catch((error) => {
      console.error(error);
      if (!/canceled|abort/i.test(error)) {
        copy();
      }
    });
  } else {
    copy();
  }
};
