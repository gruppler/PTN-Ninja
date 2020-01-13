import { LocalStorage } from "quasar";

export const url = () => (game, isPrivate = false) => {
  let url = location.origin + (process.env.DEV ? "/?#/" : "/");

  if (isPrivate && game.config.playerKey) {
    url += "player/" + game.config.playerKey;
  } else {
    url += "game/" + game.config.id;
  }

  return url;
};

export const playerName = state => (isPrivate = false) => {
  let name = "";
  if (state.user && !state.user.isAnonymous) {
    name = state.user.displayName;
  }
  return isPrivate ? LocalStorage.get("playerName") || name : name;
};
