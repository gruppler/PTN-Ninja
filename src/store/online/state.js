export default function () {
  return {
    initialized: false,
    currentGame: null,
    listeners: {},
    playerGames: {},
    gamesPrivate: {},
    gamesPublic: {},
    gamesPrivate_branches: {},
    gamesPublic_branches: {},
    analyses: {},
    analyses_branches: {},
    puzzles: {},
    user: null,
  };
}
