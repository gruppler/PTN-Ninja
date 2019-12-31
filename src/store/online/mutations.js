export const ADD_ONLINE_GAME = (state, game) => {
  state.onlineGames.unshift(game);
};

export const UPDATE_ONLINE_GAME = (state, { game, index }) => {
  state.onlineGames.splice(index, 1, game);
};

export const REMOVE_ONLINE_GAME = (state, index) => {
  state.onlineGames.splice(index, 1);
};

export const LOAD_GAMES = (state, games) => {
  state.games = games;
};

export const LISTEN_GAMES = (state, unsubscribe) => {
  state.gamesListener = unsubscribe;
};

export const UNLISTEN_GAMES = state => {
  if (state.gamesListener) {
    state.gamesListener();
    state.gamesListener = null;
  }
};
