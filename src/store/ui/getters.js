import { compressToEncodedURIComponent } from "lz-string";
import { cloneDeep, omit, sortBy } from "lodash";
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

export const playerIcon =
  (state) =>
  (player, isPrivate = false) => {
    switch (player) {
      case 1:
        return isPrivate ? "player1_private" : "player1";
      case 2:
        return isPrivate ? "player2_private" : "player2";
      case 0:
        return isPrivate ? "online_private" : "online";
      case "random":
      case "tie":
        return isPrivate ? "players_private" : "players";
    }
  };

const PNG_URL = process.env.DEV
  ? "http://localhost:5001/ptn-ninja/us-central1/tps"
  : "https://tps.ptn.ninja/";

export const png_url = (state, getters) => (game) => {
  const params = ["tps=" + game.board.tps];

  // Sizes
  if (state.pngConfig.imageSize !== "md") {
    params.push("imageSize=" + state.pngConfig.imageSize);
  }
  if (state.pngConfig.textSize !== "md") {
    params.push("textSize=" + state.pngConfig.textSize);
  }
  if (state.pngConfig.bgAlpha !== 1) {
    params.push("bgAlpha=" + state.pngConfig.bgAlpha);
  }

  // UI toggles
  [
    "axisLabels",
    "flatCounts",
    "padding",
    "pieceShadows",
    "showRoads",
    "turnIndicator",
    "unplayedPieces",
  ].forEach((toggle) => {
    if (!state.pngConfig[toggle]) {
      params.push(toggle + "=false");
    }
  });

  // Game Tags
  const tags = ["caps", "flats", "caps1", "flats1", "caps2", "flats2", "komi"];
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
    const ply = game.board.ply;
    if (ply) {
      params.push("hl=" + encodeURIComponent(ply.toString(true)));
    }
  }

  // Filename
  params.push("name=" + encodeURIComponent(game.pngFilename));

  // Theme
  if (state.pngConfig.themeID) {
    let theme = getters.theme(state.pngConfig.themeID);
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

const urlEncode = (url) => {
  return encodeURIComponent(url).replace(
    /([()])/g,
    (char) => "%" + char.charCodeAt(0).toString(16)
  );
};

export const url =
  (state, getters) =>
  (game, options = {}) => {
    if (!game) {
      return "";
    }
    if (game.config.isOnline) {
      return location.origin + "/game/" + game.config.id;
    }
    options = cloneDeep(options);

    const origin = location.origin + "/";
    let ptn =
      "names" in options && !options.names
        ? game.toString(true, true, omit(game.tags, ["player1", "player2"]))
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
        options.state = game.board;
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
      if (options.ui.themeID) {
        let theme = getters.theme(options.ui.themeID) || state.theme;
        if (theme.isBuiltIn) {
          theme = theme.id;
        } else {
          theme = JSON.stringify(theme);
        }
        delete options.ui.themeID;
        options.ui.theme = compressToEncodedURIComponent(theme);
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
