export default function () {
  return {
    initialized: false,
    openGamesListeners: {},
    privateGames: {},
    currentGameListener: null,
    playerGames: {},
    playerGamesListener: null,
    publicGames: {},
    publicGamesListener: null,
    user: null,
  };
}
