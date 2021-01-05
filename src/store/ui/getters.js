import { compressToEncodedURIComponent } from "lz-string";
import { cloneDeep, isString, omit, sortBy } from "lodash";
import { THEMES, boardOnly } from "../../themes";
import { i18n } from "../../boot/i18n";

THEMES.forEach((theme) => {
  theme.name = i18n.t("theme." + theme.id);
});
Object.freeze(THEMES);

export const themes = (state) => {
  return sortBy([...THEMES, ...state.themes], "name");
};

export const theme = (state, getters) => (id) => {
  if (!id) {
    id = state.theme;
  }
  return getters.themes.find((theme) => theme.id === id);
};

const PNG_URL = process.env.DEV
  ? "http://localhost:5001/ptn-ninja/us-central1/tps"
  : "https://tps.ptn.ninja/";

export const uniqueName = (state) => (name, ignoreFirst = false) => {
  const names = state.games.slice(1 * ignoreFirst).map((game) => game.name);
  while (names.includes(name)) {
    if (/\(\d+\)$/.test(name)) {
      name = name.replace(/\((\d+)\)$/, (match, number) => {
        number = parseInt(number, 10) + 1;
        return `(${number})`;
      });
    } else {
      name += " (1)";
    }
  }
  return name;
};

export const playerIcon = (state) => (player, isPrivate = false) => {
  let result = "";
  switch (player) {
    case 1:
      result = isPrivate ? "player1_private" : "player1";
      break;
    case 2:
      result = isPrivate ? "player2_private" : "player2";
      break;
    case 0:
      result = isPrivate ? "spectator_private" : "spectator";
      break;
    case "random":
    case "tie":
      result = isPrivate ? "players_private" : "players";
  }
  if (!state.theme.isDark) {
    result = result.startsWith("player1")
      ? result.replace("1", "2")
      : result.replace("2", "1");
  }
  return result;
};

const urlEncode = (url) => {
  return encodeURIComponent(url).replace(
    /([()])/g,
    (char) => "%" + char.charCodeAt(0).toString(16)
  );
};

export const png_filename = (state) => (game) => {
  return (
    game.name +
    " - " +
    game.state.plyID +
    (game.state.plyIsDone ? "" : "-") +
    ".png"
  );
};

export const png_url = (state, getters) => (game) => {
  const params = ["tps=" + game.state.tps];

  // UI toggles
  [
    "axisLabels",
    "flatCounts",
    "pieceShadows",
    "showRoads",
    "unplayedPieces",
  ].forEach((toggle) => {
    if (!state.pngConfig[toggle]) {
      params.push(toggle + "=false");
    }
  });

  // Game Tags
  const tags = ["caps", "flats", "caps1", "flats1", "caps2", "flats2"];
  if (state.pngConfig.includeNames) {
    tags.push("player1", "player2");
  }
  tags.forEach((tagName) => {
    const tag = game.tags[tagName];
    if (tag && tag.value) {
      params.push(tagName + "=" + encodeURIComponent(tag.value));
    }
  });

  // Square Highlights
  if (state.pngConfig.highlightSquares) {
    const ply = game.state.ply;
    if (ply) {
      params.push("hl=" + encodeURIComponent(ply.text(true)));
    }
  }

  // Filename
  params.push("name=" + encodeURIComponent(png_filename(state)(game)));

  // Theme
  if (state.pngConfig.theme) {
    let theme = state.pngConfig.theme;
    if (isString(theme)) {
      theme = getters.theme(theme);
    }
    if (theme) {
      if (theme.isBuiltIn) {
        theme = theme.id;
      } else {
        theme = JSON.stringify(boardOnly(theme));
      }
      params.push("theme=" + encodeURIComponent(theme));
    }
  }

  return PNG_URL + "?" + params.join("&");
};

export const url = (state, getters) => (game, options = {}) => {
  if (!game) {
    return "";
  }
  options = cloneDeep(options);

  const origin = location.origin + "/";
  let ptn =
    "names" in options && !options.names
      ? game.text(true, true, omit(game.tags, ["player1", "player2"]))
      : game.ptn;
  let url = compressToEncodedURIComponent(ptn);
  let params = {};

  if ("name" in options) {
    params.name = compressToEncodedURIComponent(options.name);
  } else if (game.name) {
    params.name = compressToEncodedURIComponent(game.name);
  }

  if (options.origin) {
    url = origin + url;
  }

  if (options.state) {
    if (options.state === true) {
      options.state = game.state;
    }
    if (options.state.targetBranch) {
      params.targetBranch = compressToEncodedURIComponent(
        options.state.targetBranch
      );
    }
    if (options.state.plyIndex >= 0) {
      params.ply = options.state.plyIndex;
      if (options.state.plyIsDone) {
        params.ply += "!";
      }
    }
  }

  if (options.ui) {
    if (options.ui.theme) {
      let theme = options.ui.theme;
      if (isString(theme)) {
        theme = getters.theme(theme);
      }
      if (theme) {
        if (theme.isBuiltIn) {
          theme = theme.id;
        } else {
          theme = JSON.stringify(theme);
        }
        options.ui.theme = compressToEncodedURIComponent(theme);
      }
    }
    Object.keys(options.ui).forEach((key) => {
      const value = options.ui[key];
      if (key in state.defaults && value !== state.defaults[key]) {
        params[key] = value;
      }
    });
  }

  if (Object.keys(params).length) {
    url +=
      "&" +
      Object.keys(params)
        .map((key) => key + "=" + urlEncode(params[key]))
        .join("&");
  }
  return url;
};
