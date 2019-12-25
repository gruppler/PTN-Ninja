export const url = () => (game, isPrivate = false) => {
  let url = location.origin + "/?#/";

  if (isPrivate && game.options.playerKey) {
    url += "player/" + game.options.playerKey;
  } else {
    url += "game/" + game.options.id;
  }

  return url;
};

export const icon = () => player => {
  switch (player) {
    case 1:
      return "person";
    case 2:
      return "person_outline";
    default:
      return "public";
  }
};
