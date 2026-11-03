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
    // Send status of the current game's moves, by main-line ply index:
    // "sending" | "failed"
    sendStatus: {},
    user: null,
  };
}
