export default function () {
  return {
    initialized: false,
    currentGame: null,
    listeners: {},
    playerGames: {},
    gamesPrivate: {},
    gamesPublic: {},
    // One bucket per list query: a game leaving one query (e.g. an open game
    // that is joined) must not remove it from the others
    gamesOpen: {},
    gamesOngoing: {},
    gamesRecent: {},
    gamesMinePublic: {},
    gamesMinePrivate: {},
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
