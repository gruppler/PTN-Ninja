import Vue from "vue";

export const uniqueName =
  (state) =>
  (name, ignoreFirst = false) => {
    const names = state.list.slice(1 * ignoreFirst).map((game) => game.name);
    while (names.includes(name)) {
      if (/\(\d+\)$/.test(name)) {
        name = name.replace(/\((\d+)\)$/, (match, number) => {
          number = parseInt(number, 10) + 1;
          return `(${number})`;
        });
      } else {
        name += " (1)";
      }
    }
    return name;
  };

export const disabledOptions = (state) => {
  const game = Vue.prototype.$game;
  const disabled = [];
  if (game.config.disableFlatCounts) {
    disabled.push("flatCounts");
  }
  if (game.config.disableShowRoads) {
    disabled.push("showRoads");
  }
  if (!navigator.canShare) {
    disabled.push("nativeSharing");
  }
  return disabled;
};

export const isValidSquare = () => (square) => {
  const game = Vue.prototype.$game;
  if (game) {
    return game.board.isValidSquare(square);
  }
};
