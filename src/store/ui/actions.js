import Vue from "vue";
import {
  colors,
  copyToClipboard,
  exportFile,
  Loading,
  LocalStorage,
  Dark,
  Dialog,
  Notify,
} from "quasar";
import {
  formatError,
  formatSuccess,
  formatWarning,
  formatHint,
} from "../../utilities";
import { i18n } from "../../../src/boot/i18n";
import { forEach, isArray, isEqual, isString } from "lodash";

export const SET_THEME = ({ state, getters, dispatch, commit }, theme) => {
  if (isString(theme)) {
    theme = getters.theme(theme);
  }
  if (!theme) {
    theme = getters.theme();
  }
  dispatch("WITHOUT_BOARD_ANIM", () => {
    forEach(theme.colors, (color, name) => colors.setBrand(name, color));
    Dark.set(!!theme.isDark);
  });
};

export const SET_UI = ({ state, commit }, [key, value]) => {
  if (key in state.defaults) {
    if (!state.embed) {
      LocalStorage.set(key, value);
    }
    commit("SET_UI", [key, value]);
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

export const NOTIFY = (context, options) => {
  let fg = "grey-1";
  let bg = "ui";
  if (options.invert) {
    [bg, fg] = [fg, bg];
  }
  if (options.actions) {
    options.actions.forEach((action) => {
      if (!action.color) {
        action.color = "primary";
      }
    });
  }
  return Notify.create({
    progressClass: "bg-" + fg,
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
    actions: [{ icon: "close", color: "grey-1" }],
  });
};

export const NOTIFY_SUCCESS = (context, success) => {
  return Notify.create({
    message: formatSuccess(success),
    type: "positive",
    timeout: 0,
    position: "top-right",
    multiLine: false,
    actions: [{ icon: "close", color: "grey-1" }],
  });
};

export const NOTIFY_WARNING = (context, warning) => {
  return Notify.create({
    message: formatWarning(warning),
    type: "warning",
    timeout: 0,
    position: "top-right",
    multiLine: false,
    actions: [{ icon: "close", color: "dark" }],
  });
};

export const NOTIFY_HINT = (context, hint) => {
  return Notify.create({
    message: formatHint(hint),
    type: "info",
    timeout: 0,
    position: "top-right",
    multiLine: false,
    actions: [{ icon: "close", color: "grey-1" }],
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

export const ADD_GAME = ({ commit, dispatch, getters }, game) => {
  const gameNames = LocalStorage.getItem("games") || [];

  game.name = getters.uniqueName(game.name);
  gameNames.unshift(game.name);
  LocalStorage.set("games", gameNames);
  LocalStorage.set("ptn-" + game.name, game.ptn);
  if (game.state) {
    LocalStorage.set("state-" + game.name, game.minState || game.state);
  }
  if (game.config) {
    LocalStorage.set("config-" + game.name, game.config);
  } else {
    game.config = {};
  }
  if (game.history) {
    LocalStorage.set("history-" + game.name, game.history);
    LocalStorage.set("historyIndex-" + game.name, game.historyIndex);
  }

  dispatch("WITHOUT_BOARD_ANIM", () => commit("ADD_GAME", game));
};

export const ADD_GAMES = ({ commit, dispatch, getters }, { games, index }) => {
  const gameNames = LocalStorage.getItem("games") || [];

  games.forEach((game, i) => {
    game.name = getters.uniqueName(game.name);
    gameNames.splice(index + i, 0, game.name);
    LocalStorage.set("games", gameNames);
    LocalStorage.set("ptn-" + game.name, game.ptn);
    if (game.state) {
      LocalStorage.set("state-" + game.name, game.minState || game.state);
    }
    if (game.config) {
      LocalStorage.set("config-" + game.name, game.config);
    } else {
      game.config = {};
    }
    if (game.history) {
      LocalStorage.set("history-" + game.name, game.history);
      LocalStorage.set("historyIndex-" + game.name, game.historyIndex);
    }
  });

  dispatch("WITHOUT_BOARD_ANIM", () => commit("ADD_GAMES", { games, index }));
};

export const REMOVE_GAME = ({ commit, dispatch, state }, index) => {
  const game = state.games[index];
  const games = LocalStorage.getItem("games") || [];
  const name = games.splice(index, 1);
  LocalStorage.set("games", games);
  LocalStorage.remove("ptn-" + name);
  LocalStorage.remove("state-" + name);
  LocalStorage.remove("config-" + name);
  LocalStorage.remove("history-" + name);
  LocalStorage.remove("historyIndex-" + name);

  const finish = () => {
    commit("REMOVE_GAME", index);
    Vue.nextTick(() => {
      const icon = game.config.isOnline
        ? getters.playerIcon(game.config.player, game.config.isPrivate)
        : "file";
      dispatch("NOTIFY", {
        icon,
        message: i18n.t("Game x closed", { game: game.name }),
        timeout: 5000,
        progress: true,
        multiLine: false,
        actions: [
          {
            label: i18n.t("Undo"),
            color: "primary",
            handler: () => {
              if (index === 0) {
                Loading.show();
                setTimeout(() => {
                  dispatch("WITHOUT_BOARD_ANIM", () => {
                    dispatch("ADD_GAMES", { games: [game], index });
                    Loading.hide();
                  });
                }, 200);
              } else {
                dispatch("ADD_GAMES", { games: [game], index });
              }
            },
          },
          { icon: "close", color: "grey-2" },
        ],
      });
    });
  };

  if (index === 0) {
    Loading.show();
    setTimeout(() => {
      dispatch("WITHOUT_BOARD_ANIM", () => {
        finish();
        Loading.hide();
      });
    }, 200);
  } else {
    finish();
  }
};

export const REMOVE_MULTIPLE_GAMES = (
  { commit, dispatch, state },
  { start, count }
) => {
  const games = state.games.slice(start, start + count);
  const gameNames = LocalStorage.getItem("games") || [];
  const names = gameNames.splice(start, count);
  LocalStorage.set("games", gameNames);
  names.forEach((name) => {
    LocalStorage.remove("ptn-" + name);
    LocalStorage.remove("state-" + name);
    LocalStorage.remove("config-" + name);
    LocalStorage.remove("history-" + name);
    LocalStorage.remove("historyIndex-" + name);
  });

  const finish = () => {
    commit("REMOVE_MULTIPLE_GAMES", { start, count });
    Vue.nextTick(() => {
      dispatch("NOTIFY", {
        icon: "close_multiple",
        message: i18n.tc("success.closedMultipleGames", count),
        timeout: 5000,
        progress: true,
        actions: [
          {
            label: i18n.t("Undo"),
            color: "primary",
            handler: () => {
              if (start === 0) {
                Loading.show();
                setTimeout(() => {
                  dispatch("WITHOUT_BOARD_ANIM", () => {
                    dispatch("ADD_GAMES", { games, index: start });
                    Loading.hide();
                  });
                }, 200);
              } else {
                dispatch("ADD_GAMES", { games, index: start });
              }
            },
          },
          { icon: "close", color: "grey-2" },
        ],
      });
    });
  };

  if (start === 0) {
    Loading.show();
    setTimeout(() => {
      dispatch("WITHOUT_BOARD_ANIM", () => {
        finish();
        Loading.hide();
      });
    }, 200);
  } else {
    finish();
  }
};

export const UPDATE_PTN = ({ state, commit }, ptn) => {
  LocalStorage.set("ptn-" + state.games[0].name, ptn);
  commit("UPDATE_PTN", ptn);
};

export const SET_NAME = ({ state, commit, getters }, { oldName, newName }) => {
  let index = state.games.findIndex((game) => game.name === oldName);
  if (index < 0) {
    throw new Error("Game not found: " + oldName);
  }
  let games = LocalStorage.getItem("games");
  let name = getters.uniqueName(newName, true);
  games[index] = name;
  LocalStorage.set("games", games);
  LocalStorage.remove("ptn-" + oldName);
  LocalStorage.set("ptn-" + name, state.games[index].ptn);
  LocalStorage.remove("state-" + oldName);
  LocalStorage.set("state-" + name, state.games[index].state);
  if (state.games[index].config) {
    LocalStorage.remove("config-" + oldName);
    LocalStorage.set("config-" + name, state.games[index].config);
  }
  if (state.games[index].history) {
    LocalStorage.remove("history-" + oldName);
    LocalStorage.set(
      "history-" + state.games[index].name,
      state.games[index].history
    );
    LocalStorage.remove("historyIndex-" + oldName);
    LocalStorage.set(
      "historyIndex-" + state.games[index].name,
      state.games[index].historyIndex
    );
  }
  commit("SET_NAME", { oldName, newName });
};

export const SET_STATE = ({ commit, state }, { game, gameState }) => {
  if (!state.games.some((g) => g.name === game.name)) {
    throw new Error("Game not found: " + game.name);
  }
  LocalStorage.set("state-" + game.name, gameState);
  commit("SET_STATE", { game, gameState });
};

export const SET_CONFIG = ({ commit, state }, { game, config }) => {
  if (!state.games.some((g) => g.name === game.name)) {
    throw new Error("Game not found: " + game.name);
  }
  LocalStorage.set("config-" + game.name, config);
  commit("SET_CONFIG", { game, config });
};

export const SELECT_GAME = ({ commit, dispatch }, { index, immediate }) => {
  let games = LocalStorage.getItem("games") || [];
  games.unshift(games.splice(index, 1)[0]);
  LocalStorage.set("games", games);
  if (immediate) {
    commit("SELECT_GAME", index);
  } else {
    Loading.show();
    setTimeout(() => {
      dispatch("WITHOUT_BOARD_ANIM", () => {
        commit("SELECT_GAME", index);
        Loading.hide();
      });
    }, 200);
  }
};

export const CANCEL_MOVE = ({ commit }, game) => {
  commit("CANCEL_MOVE", game);
};

export const UNDO = ({ commit, dispatch }, game) => {
  dispatch("WITHOUT_BOARD_ANIM", () => {
    commit("UNDO", game);
  });
};

export const REDO = ({ commit, dispatch }, game) => {
  dispatch("WITHOUT_BOARD_ANIM", () => {
    commit("REDO", game);
  });
};

export const TRIM_BRANCHES = ({ commit, dispatch }, game) => {
  dispatch("WITHOUT_BOARD_ANIM", () => {
    commit("TRIM_BRANCHES", game);
  });
};

export const TRIM_TO_BOARD = ({ commit, dispatch }, game) => {
  dispatch("WITHOUT_BOARD_ANIM", () => {
    commit("TRIM_TO_BOARD", game);
  });
};

export const TRIM_TO_PLY = ({ commit, dispatch }, game) => {
  dispatch("WITHOUT_BOARD_ANIM", () => {
    commit("TRIM_TO_PLY", game);
  });
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

export const SAVE_UNDO_HISTORY = ({ commit }, game) => {
  LocalStorage.set("history-" + game.name, game.history);
  commit("SAVE_UNDO_HISTORY", game);
};

export const SAVE_UNDO_INDEX = ({ commit }, game) => {
  LocalStorage.set("historyIndex-" + game.name, game.historyIndex);
  commit("SAVE_UNDO_INDEX", game);
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
