import { i18n } from "../../boot/i18n";

import { compressToEncodedURIComponent } from "lz-string";
import { isArray, omit } from "lodash";

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

export const playerIcon = () => (player) => {
  switch (player) {
    case 1:
      return "player1";
    case 2:
      return "player2";
    case 0:
      return "spectator";
    case "random":
    case "tie":
      return "players";
    default:
      return "";
  }
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

export const png_url = (state) => (game) => {
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
      params.push("ply=" + encodeURIComponent(ply.text(true)));
    }
  }

  // Filename
  params.push("name=" + encodeURIComponent(png_filename(state)(game)));

  return PNG_URL + "?" + params.join("&");
};

export const url = (state) => (game, options = {}) => {
  if (!game) {
    return "";
  }

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

export const sharableFiles = (state) => (files) => {
  if (!isArray(files)) {
    files = [files];
  }
  return Object.freeze(files);
};
