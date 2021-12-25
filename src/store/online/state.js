export default function () {
  return {
    initialized: false,
    privateGames: {},
    currentGameListener: null,
    playerGames: {},
    playerGamesListener: null,
    publicGames: {},
    publicGamesListener: null,
    user: null,
  };
}
