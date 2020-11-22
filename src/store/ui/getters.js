import { compressToEncodedURIComponent } from "lz-string";
import { omit } from "lodash";

export const uniqueName = state => (name, ignoreFirst = false) => {
  const names = state.games.slice(1 * ignoreFirst).map(game => game.name);
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

export const playerIcon = () => (player, isPrivate = false) => {
  switch (player) {
    case 1:
      return isPrivate ? "player1_private" : "player1";
    case 2:
      return isPrivate ? "player2_private" : "player2";
    case 0:
      return isPrivate ? "spectator_private" : "spectator";
    case "random":
    case "tie":
      return isPrivate ? "players_private" : "players";
    default:
      return "";
  }
};

const urlEncode = url => {
  return encodeURIComponent(url).replace(
    /([()])/g,
    char => "%" + char.charCodeAt(0).toString(16)
  );
};

export const url = state => (game, options = {}) => {
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
    Object.keys(options.ui).forEach(key => {
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
        .map(key => key + "=" + urlEncode(params[key]))
        .join("&");
  }
  return url;
};
