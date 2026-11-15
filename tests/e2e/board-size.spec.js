// @ts-check
// boardSize.js's formula on its own: plain code, no page
const { test, expect } = require("@playwright/test");
const { EMK, boardWidth } = require("../../src/components/board/boardSize.js");

// The container's grid, as CSS lays it out: the y axis's 1.5em (with the
// coordinates on the frame), the board's column (size fr) and the unplayed
// pieces' (1.75fr), with em = min(30px, EMK * the board's width). The width
// they take up for a board `board` px wide.
const gridWidth = ({ board, size, axisLabels, unplayed }) => {
  const em = Math.min(30, EMK * board);
  return (
    board + (unplayed ? (1.75 * board) / size : 0) + (axisLabels ? 1.5 * em : 0)
  );
};

test("the board's width fills the container's grid exactly", () => {
  let cases = 0;
  let capped = 0;
  for (const width of [120, 333, 500, 640, 800, 1000, 1280, 1900, 3000])
    for (const size of [3, 4, 5, 6, 7, 8])
      for (const axisLabels of [false, true])
        for (const unplayed of [false, true]) {
          const args = { width, size, axisLabels, unplayed };
          const board = boardWidth(args);
          const label = JSON.stringify(args);
          expect(board, label).toBeGreaterThan(0);
          expect(board, label).toBeLessThanOrEqual(width);
          expect(
            gridWidth({ board, size, axisLabels, unplayed }),
            label
          ).toBeCloseTo(width, 6);
          cases++;
          if (axisLabels && EMK * board > 30) capped++;
        }
  expect(cases).toBe(216);
  // Both sides of the font size's limit were tried
  expect(capped).toBeGreaterThan(0);
  expect(capped).toBeLessThan(108);
});

test("the board's width, worked by hand", () => {
  // No axis, no unplayed column: the whole width
  expect(
    boardWidth({ width: 600, size: 6, axisLabels: false, unplayed: false })
  ).toBe(600);
  // The unplayed column alone: 6 / 7.75 of it
  expect(
    boardWidth({ width: 775, size: 6, axisLabels: false, unplayed: true })
  ).toBeCloseTo(600, 9);
  // The axis below the font size's limit: board (1 + 1.5 × 0.04375) = width
  expect(
    boardWidth({ width: 532.8125, size: 5, axisLabels: true, unplayed: false })
  ).toBeCloseTo(500, 9);
  // The axis above it (the board over 30 / 0.04375 ≈ 685.7 px): width − 45
  expect(
    boardWidth({ width: 1045, size: 5, axisLabels: true, unplayed: false })
  ).toBeCloseTo(1000, 9);
});
