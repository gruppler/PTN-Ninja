import { LocalStorage } from "quasar";

export const url = () => game => {
  let url = location.origin + "/";

  url += "game/" + game.config.id;

  return url;
};

export const playerName = state => (isPrivate = false) => {
  let name = "";
  if (state.user && !state.user.isAnonymous) {
    name = state.user.displayName;
  }
  return isPrivate ? LocalStorage.getItem("playerName") || name : name;
};
