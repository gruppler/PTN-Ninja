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

export const canEdit = (state) => (game) => {
  // TODO: Actually check permissions
  return !game.config.isOnline;
};
