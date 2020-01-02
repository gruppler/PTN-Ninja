const ORIGIN = location.origin + (process.env.DEV ? "/?#/" : "/");

export const url = () => (game, isPrivate = false) => {
  let url = ORIGIN;

  if (isPrivate && game.config.playerKey) {
    url += "player/" + game.config.playerKey;
  } else {
    url += "game/" + game.config.id;
  }

  return url;
};
