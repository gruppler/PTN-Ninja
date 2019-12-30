import { LocalStorage } from "quasar";

export default function() {
  return {
    onlineGames: LocalStorage.getItem("onlineGames") || [],
    gamesListener: null,
    games: []
  };
}
