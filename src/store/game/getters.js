export const uniqueName = (state) => (name, ignoreFirst = false) => {
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
