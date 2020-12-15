export default function () {
  return {
    initialized: false,
    privateGames: {},
    activeGames: {},
    activeGamesListener: null,
    playerGames: {},
    playerGamesListener: null,
    publicGames: {},
    publicGamesListener: null,
    user: null,
  };
}
