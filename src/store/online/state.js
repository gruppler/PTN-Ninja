export default function() {
  return {
    initialized: false,
    privateGames: {},
    playerGames: {},
    playerGamesListener: null,
    publicGames: {},
    publicGamesListener: null,
    user: null
  };
}
