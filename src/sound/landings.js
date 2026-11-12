import TPS from "../Game/PTN/TPS";

const pieceKind = (specialPiece) =>
  specialPiece === "C" ? "cap" : specialPiece === "S" ? "wall" : "flat";

const cellAt = (grid, square) =>
  grid[Number(square.slice(1)) - 1]["abcdefgh".indexOf(square[0])];

/**
 * The sounds a ply makes, in the order its pieces land.
 * @param {object} ply A ply as the store exposes it
 * @returns {{name: string, player: 1|2}[]}
 */
export const landingsOf = (ply) => {
  if (!ply.direction) {
    return [{ name: pieceKind(ply.specialPiece), player: ply.color }];
  }

  const { grid } = new TPS(ply.tpsBefore);
  const origin = cellAt(grid, ply.squares[0]);
  const drops = Array.from(ply.distribution, Number);
  const carried = origin
    .replace(/[SC]$/, "")
    .slice(-drops.reduce((a, b) => a + b, 0));
  const topKind = pieceKind(origin.slice(-1));

  let start = 0;
  return drops.map((count, i) => {
    const player = Number(carried[start + count - 1]);
    start += count;
    const isLast = i === drops.length - 1;
    if (isLast && ply.wallSmash) {
      return { name: "smash", player };
    }
    const name = isLast ? topKind : "flat";
    const occupied = cellAt(grid, ply.squares[i + 1]) !== "x";
    return { name: occupied ? name + "Stack" : name, player };
  });
};
