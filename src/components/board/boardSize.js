// The 2D board's width, from its container's: what Board.vue's observer on
// the board would measure once the container has its width, worked out from
// the container's grid so that the board takes its size in one pass. Plain
// code: the 2D and 2.5D boards use it, and it pulls in nothing.
//
// The container's grid has the y axis (1.5em, with the coordinates on the
// frame) left of the board's column (size fr) and, in the horizontal layout
// with the unplayed pieces, their column (1.75fr) right of it. Its font size
// is min(30px, EMK * the board's width).

// The container's font size per px of the board's width, and its largest
export const EMK = 0.04375;
const MAX_EM = 30;
// The y axis's width in em, and the unplayed pieces' column in squares
const AXIS = 1.5;
const UNPLAYED = 1.75;

// `width` is the container's in px; `axisLabels` whether the coordinates
// are on the frame (not in the board, and not off); `unplayed` whether the
// unplayed pieces have their column beside the board
export function boardWidth({ width, size, axisLabels, unplayed }) {
  // The board's share of what the y axis leaves
  const share = unplayed ? size / (size + UNPLAYED) : 1;
  if (!axisLabels) {
    return width * share;
  }
  // board = share * (width - AXIS * em), with em = EMK * board below its
  // largest, and MAX_EM above
  const board = (share * width) / (1 + AXIS * EMK * share);
  return EMK * board > MAX_EM ? share * (width - AXIS * MAX_EM) : board;
}
