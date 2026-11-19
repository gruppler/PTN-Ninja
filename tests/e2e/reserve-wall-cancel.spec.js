// @ts-check
const { test, expect, loadPTN } = require("./helpers");

/**
 * A reserve piece selected as a wall goes back to being a flat once it is
 * deselected, however that happens. Esc used to leave it standing in the
 * reserve, and selecting it again started it as a wall.
 */

const GAME = `[Size "5"]\n\n1. a1 e5`;

// The Piece component of a piece, by id
const FIND_PIECE = `(id) => {
  const find = (vm) => {
    if (vm.$options.name === "Piece" && vm.id === id) {
      return vm;
    }
    for (const child of vm.$children) {
      const found = find(child);
      if (found) {
        return found;
      }
    }
    return null;
  };
  return find(window.app);
}`;

// The reserve flat that would be played next for the player to move: how
// many pieces are selected, and whether it draws as a wall
const nextFlat = (page) =>
  page.evaluate((FIND_PIECE) => {
    const findPiece = eval(FIND_PIECE);
    const game = window.app.$store.state.game;
    const color = game.position.color;
    const index = game.board.piecesPlayed[color].flat;
    const piece = findPiece(`${color}f${index + 1}`);
    return {
      id: piece && piece.id,
      selected: game.selected.pieces.length,
      standing: piece.$refs.stone.classList.contains("S"),
    };
  }, FIND_PIECE);

// Click the reserve's next flat as a person would, once the reserve has
// stopped moving (a game just loaded slides its pieces into place) and the
// loading overlay has faded
const clickReserveFlat = async (page) => {
  const box = await page
    .waitForFunction((FIND_PIECE) => {
      const findPiece = eval(FIND_PIECE);
      const game = window.app.$store.state.game;
      const color = game.position.color;
      const index = game.board.piecesPlayed[color].flat;
      const piece = findPiece(`${color}f${index + 1}`);
      if (
        !piece ||
        document.querySelector(".q-loading") ||
        piece.$el
          .getAnimations({ subtree: true })
          .some((animation) => animation.playState === "running")
      ) {
        return null;
      }
      const rect = piece.$refs.stone.getBoundingClientRect();
      return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
    }, FIND_PIECE)
    .then((handle) => handle.jsonValue());
  await page.mouse.click(box.x, box.y);
};

// Select the reserve flat, then click it again to stand it up as a wall
const selectReserveWall = async (page) => {
  await clickReserveFlat(page);
  expect(await nextFlat(page)).toMatchObject({ selected: 1, standing: false });
  await clickReserveFlat(page);
  expect(await nextFlat(page)).toMatchObject({ selected: 1, standing: true });
};

test.describe("A reserve wall deselected", () => {
  test.beforeEach(async ({ page }) => {
    await loadPTN(page, GAME);
  });

  test("by Esc goes back to a flat", async ({ page }) => {
    await selectReserveWall(page);
    await page.keyboard.press("Escape");
    expect(await nextFlat(page)).toMatchObject({
      selected: 0,
      standing: false,
    });

    // Selecting it again starts it as a flat
    await clickReserveFlat(page);
    expect(await nextFlat(page)).toMatchObject({
      selected: 1,
      standing: false,
    });
    await page.keyboard.press("Escape");
  });

  test("by selecting the capstone goes back to a flat", async ({ page }) => {
    await selectReserveWall(page);
    await page.evaluate(() =>
      window.app.$store.dispatch("game/SELECT_PIECE", { type: "cap" })
    );
    expect(await nextFlat(page)).toMatchObject({ standing: false });
    await page.keyboard.press("Escape");
    expect(await nextFlat(page)).toMatchObject({
      selected: 0,
      standing: false,
    });
  });
});

// The ply just played, and whether the piece it left on its square stands
const played = (page, coord) =>
  page.evaluate((coord) => {
    const game = window.app.$store.state.game;
    const pieces = Object.values(game.board.pieces).filter(
      (piece) => piece.square === coord
    );
    return {
      ply: game.position.ply.text,
      standing: pieces.length === 1 && pieces[0].isStanding,
    };
  }, coord);

// Flattening a deselected reserve piece must not flatten the wall it plays
test.describe("A reserve wall placed", () => {
  test.beforeEach(async ({ page }) => {
    await loadPTN(page, GAME);
  });

  test("by clicks plays a wall, for both players", async ({ page }) => {
    await selectReserveWall(page);
    await page.click('.square[data-coord="c3"]');
    expect(await played(page, "c3")).toEqual({ ply: "Sc3", standing: true });

    await selectReserveWall(page);
    await page.click('.square[data-coord="d3"]');
    expect(await played(page, "d3")).toEqual({ ply: "Sd3", standing: true });
  });

  test("through the store plays a wall, for both players", async ({ page }) => {
    const placeWall = async (square) => {
      await page.evaluate((square) => {
        const store = window.app.$store;
        store.dispatch("game/SELECT_PIECE", { type: "flat" });
        store.dispatch("game/SELECT_PIECE", { type: "flat", alt: true });
        store.dispatch("game/SELECT_SQUARE", { square });
      }, square);
    };
    await placeWall("c3");
    expect(await played(page, "c3")).toEqual({ ply: "Sc3", standing: true });
    await placeWall("d3");
    expect(await played(page, "d3")).toEqual({ ply: "Sd3", standing: true });
  });
});
