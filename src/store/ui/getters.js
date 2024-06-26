import { Loading } from "quasar";
import { compressToEncodedURIComponent } from "lz-string";
import { cloneDeep, isString, omit, sortBy } from "lodash";
import { THEMES, boardOnly } from "../../themes";
import { notifyError } from "../../utilities";
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

const GIF_URL = process.env.DEV
  ? `http://localhost:5001/${process.env.projectId}/us-central1/gif`
  : "https://tps.ptn.ninja/gif";

export const gif_filename =
  () =>
  ({ name, min, max }) => {
    return `${name} - ${min + 1}-${max}.gif`;
  };

export const gif_url = () => (options) => {
  // Theme
  if (options.theme && !isString(options.theme)) {
    options.theme = JSON.stringify(options.theme);
  }

  const params = [];
  Object.keys(options).forEach((key) =>
    params.push(`${key}=${encodeURIComponent(options[key])}`)
  );

  return GIF_URL + "?" + params.join("&");
};

const PNG_URL = process.env.DEV
  ? `http://localhost:5001/${process.env.projectId}/us-central1/png`
  : "https://tps.ptn.ninja/png";

export const pngFilename =
  () =>
  ({ name, plyID, plyIsDone }) => {
    return `${name} - ${plyID}${plyIsDone ? "" : "-"}.png`;
  };

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
  if (state.pngConfig.moveNumber) {
    params.push("moveNumber=" + game.board.move.linenum.number);
  }

  // UI toggles
  [
    "axisLabels",
    "flatCounts",
    "padding",
    "stackCounts",
    "showRoads",
    "moveNumber",
    "evalText",
    "turnIndicator",
    "unplayedPieces",
  ].forEach((toggle) => {
    if (!state.pngConfig[toggle]) {
      params.push(toggle + "=false");
    }
  });

  // Game Tags
  const tags = [
    "size",
    "caps",
    "flats",
    "caps1",
    "flats1",
    "caps2",
    "flats2",
    "komi",
    "opening",
  ];
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
  params.push(
    "name=" +
      encodeURIComponent(
        getters.pngFilename({
          name: game.name,
          plyID: game.board.plyID,
          plyIsDone: game.board.plyIsDone,
        })
      )
  );

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
        ? game.toString({ tags: omit(game.tags, ["player1", "player2"]) })
        : game.ptn;
    let url = compressToEncodedURIComponent(ptn);
    let params = {};

    if ("name" in options) {
      params.name = options.name
        ? compressToEncodedURIComponent(options.name)
        : "";
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

const SHORTENER_SERVICE = process.env.DEV
  ? `http://localhost:5001/${process.env.projectId}/us-central1/short`
  : "https://us-central1-ptn-ninja.cloudfunctions.net/short";

export const urlShort =
  () =>
  async (game, options = {}) => {
    if (!game) {
      return "";
    }
    if (game.config.isOnline) {
      return location.origin + "/game/" + game.config.id;
    }
    options = cloneDeep(options);

    let ptn =
      "names" in options && !options.names
        ? game.toString({ tags: omit(game.tags, ["player1", "player2"]) })
        : game.ptn;
    let params = {};

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
      Loading.show();
      const response = await fetch(SHORTENER_SERVICE, {
        method: "POST",
        mode: "cors",
        body: JSON.stringify({ ptn, params }),
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
      return await response.text();
    } catch (error) {
      Loading.hide();
      notifyError(error);
      return false;
    }
  };

export const urlUnshort = () => async (id) => {
  try {
    const response = await fetch(SHORTENER_SERVICE + "?id=" + id);
    if (!response.ok) {
      const json = await response.json();
      if (json && json.message) {
        return notifyError(json.message);
      } else {
        return notifyError("HTTP-Error: " + response.status);
      }
    }
    return await response.json();
  } catch (error) {
    notifyError(error);
    return null;
  }
};
