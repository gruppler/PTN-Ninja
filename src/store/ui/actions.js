import Vue from "vue";
import JSZip from "jszip";

import {
  copyToClipboard,
  exportFile,
  Loading,
  LocalStorage,
  Dialog,
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
import { SHORTENER_SERVICE } from "../../constants";
import { i18n } from "../../boot/i18n";
import {
  cloneDeep,
  isArray,
  isFunction,
  isObject,
  isString,
  pick,
} from "lodash";
import { TPStoPNG } from "tps-ninja";
import hashObject from "object-hash";

export const SET_THEME = ({ state, getters, commit }, theme) => {
  if (isString(theme)) {
    theme = getters.theme(theme);
  }
  if (!theme) {
    theme = getters.theme() || THEMES.find((t) => t.id === "classic");
  }
  if (!state.embed) {
    try {
      LocalStorage.set("theme", theme);
    } catch (error) {
      if (error.code === 22) {
        error = "localstorageFull";
      }
      notifyError(error);
    }
  }
  commit("SET_THEME", theme);
};

export const SET_UI = ({ state, commit, dispatch }, [key, value]) => {
  if (key in state.defaults) {
    if (!state.embed) {
      try {
        LocalStorage.set(key, value);
      } catch (error) {
        if (error.code === 22) {
          error = "localstorageFull";
        }
        notifyError(error);
      }
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
      try {
        LocalStorage.set(key, !state[key]);
      } catch (error) {
        if (error.code === 22) {
          error = "localstorageFull";
        }
        notifyError(error);
      }
    }
    commit("SET_UI", [key, !state[key]]);
  }
};

export const PROMPT = (context, options) => {
  return prompt(options);
};

export const NOTIFY = (context, options) => {
  return notify(options);
};

export const NOTIFY_ERROR = (context, error) => {
  let args = error;
  if (isObject(args) && args.message) {
    args = [args.message, pick(args, ["timeout", "position"])];
  } else {
    args = [args];
  }
  return notifyError(...args);
};

export const NOTIFY_SUCCESS = (context, success) => {
  let args = success;
  if (isObject(args) && args.message) {
    args = [args.message, pick(args, ["timeout", "position"])];
  } else {
    args = [args];
  }
  return notifySuccess(...args);
};

export const NOTIFY_WARNING = (context, warning) => {
  let args = warning;
  if (isObject(args) && args.message) {
    args = [args.message, pick(args, ["timeout", "position"])];
  } else {
    args = [args];
  }
  return notifyWarning(...args);
};

export const NOTIFY_HINT = (context, hint) => {
  let args = hint;
  if (isObject(args) && args.message) {
    args = [args.message, pick(args, ["timeout", "position"])];
  } else {
    args = [args];
  }
  return notifyHint(...args);
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
  // input.accept = ".ptn,.txt";
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

export const DOWNLOAD_FILES = async ({ dispatch, getters }, files) => {
  let success = false;
  if (!isArray(files)) {
    success = exportFile(files.name, files);
  } else if (files.length === 1) {
    success = exportFile(files[0].name, files[0]);
  } else {
    let zip = new JSZip();
    files.forEach((file) => {
      zip.file(file.name.replace(/[\/\\]/g, "-"), file);
    });
    let zipFile = await zip.generateAsync({
      type: JSZip.support.uint8array ? "uint8array" : "string",
    });
    success = exportFile("ptn.zip", zipFile);
  }

  if (!success) {
    dispatch("NOTIFY_ERROR", "Unable to download");
  }
};

export const COPY = async function ({ dispatch }, { text, title }) {
  try {
    await copyToClipboard(text);
    dispatch("NOTIFY", {
      icon: "copy",
      message: i18n.t(title ? "success.copiedItem" : "success.copied", {
        item: title,
      }),
      timeout: 1000,
    });
  } catch (error) {
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
  }
};

export const PASTE = function ({ dispatch }) {
  if (
    !(
      navigator &&
      navigator.clipboard &&
      isFunction(navigator.clipboard.readText)
    )
  ) {
    dispatch("NOTIFY_ERROR", "Unable to read clipboard");
    return "";
  }
  return navigator.clipboard.readText();
};

export const SHARE = function ({ dispatch, state }, { text, title }) {
  if (navigator.canShare && state.nativeSharing) {
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

const THUMBNAIL_CONFIG = Object.freeze({
  font: "Roboto",
  imageSize: "xs",
  axisLabels: false,
  turnIndicator: false,
  highlightSquares: true,
  unplayedPieces: false,
  padding: false,
  bgAlpha: 0,
});

export const GET_THUMBNAIL = ({ commit, state }, options) => {
  return new Promise((resolve, reject) => {
    options = {
      theme: state.theme,
      showRoads: state.showRoads,
      stackCounts: state.stackCounts,
      transform: state.boardTransform,
      ...THUMBNAIL_CONFIG,
      ...options,
    };
    const id = hashObject(options);
    const existing = state.thumbnails[id];
    if (existing) {
      resolve(existing.url);
    } else {
      // Generate thumbnail
      try {
        TPStoPNG(options).toBlob((blob) => {
          const url = URL.createObjectURL(blob);
          commit("SET_THUMBNAIL", { id, options, url });
          resolve(url);
        }, "image/png");
      } catch (error) {
        reject(error);
      }
    }
  });
};

export const GET_SHORT_URL = async ({ commit, state }, { game, options }) => {
  if (!game) {
    return "";
  }
  if (game.config.isOnline) {
    return location.origin + "/game/" + game.config.id;
  }
  options = cloneDeep(options);

  const ptn = game.ptn;
  const params = {};

  if ("name" in options) {
    params.name = options.name || "";
  } else if (game.name) {
    params.name = game.name;
  }

  if (options.state) {
    if (options.state === true) {
      options.state = game.board;
    }
    if (options.state.targetBranch) {
      params.targetBranch = options.state.targetBranch;
    }
    if (options.state.plyIndex >= 0) {
      params.ply = String(options.state.plyIndex);
      if (options.state.plyIsDone) {
        params.ply += "!";
      }
    }
  }

  try {
    const data = { ptn, params };
    const hash = hashObject(data);
    if (hash in state.shortLinks) {
      return state.shortLinks[hash];
    }
    Loading.show();
    const response = await fetch(SHORTENER_SERVICE, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      mode: "cors",
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      const json = await response.json();
      if (json && json.message) {
        return notifyError(json.message);
      } else {
        return notifyError("HTTP-Error: " + response.status);
      }
    }
    Loading.hide();
    const url = await response.text();
    commit("SET_SHORT_LINK", { hash, url });
    return url;
  } catch (error) {
    Loading.hide();
    notifyError(error);
    return false;
  }
};
