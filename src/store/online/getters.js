import Vue from "vue";
import { LocalStorage } from "quasar";

export const playerName =
  (state) =>
  (isPrivate = false) => {
    let name = "";
    if (state.user && !state.user.isAnonymous) {
      name = state.user.displayName;
    }
    return isPrivate ? LocalStorage.getItem("playerName") || name : name;
  };

export const playerFromUID = (state) => (uid) => {
  const game = Vue.prototype.$game;
  if (game) {
    return game.getPlayerFromUID(uid);
  }
};

export const openPlayer = (state) => {
  const game = Vue.prototype.$game;
  if (game) {
    return game.openPlayer;
  }
};
