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
  if (!game.hasEnded) {
    if (!game.config.flatCounts) {
      disabled.push("flatCounts");
    }
    if (!game.config.stackCounts) {
      disabled.push("stackCounts");
    }
    if (!game.config.showRoads) {
      disabled.push("showRoads");
    }
    if (!game.config.allowScratchboard) {
      disabled.push("allowScratchboard");
    }
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
