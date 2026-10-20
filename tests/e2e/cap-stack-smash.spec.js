// @ts-check
const { test, expect } = require("@playwright/test");

/**
 * Moving a capstone stack toward a wall must end in a legal smash: the
 * capstone alone on the wall.
 *
 * In this position white's f2 stack (1221C) moves up through flats on f3 and
 * f4 toward black's wall on f5. The wall counted as a valid target whenever
 * the top held piece was a capstone, however many pieces were held, and the
 * auto-drop before a wall only fired on an empty square. So clicking up the
 * file recorded the illegal `4f2+112*`, and carrying on to f6 recorded
 * `4f2+*` with the capstone on f6.
 */

const TPS =
  "2,1,2212,1S,1,1/2,1,x,2,12,112S/1S,x2,1S,1,1/2,21S,x,2C,x,1/2,x,1,2,2S,1221C/2,x,2,x,1,1 1 26";

async function load(page) {
  await page.evaluate(async (tps) => {
    await window.app.$store.dispatch("game/ADD_GAME", {
      ptn: `[Size "6"]\n[TPS "${tps}"]\n`,
      name: "Cap Stack Smash",
    });
  }, TPS);
  await page.waitForFunction(() => window.app.$game && window.app.$game.board);
}

/** Click squares the way Square.vue does: only valid squares respond. */
async function click(page, squares) {
  return page.evaluate(async (squares) => {
    const store = window.app.$store;
    const board = window.app.$game.board;
    const refused = [];
    for (const coord of squares) {
      if (!board.isValidSquare(board.getSquare(coord))) {
        refused.push(coord);
        continue;
      }
      await store.dispatch("game/SELECT_SQUARE", { square: coord });
    }
    return refused;
  }, squares);
}

const result = (page) =>
  page.evaluate(() => {
    const game = window.app.$game;
    const last = game.plies.filter(Boolean).pop();
    const stack = (coord) =>
      game.board
        .getSquare(coord)
        .pieces.map(
          (p) => p.color + (p.isCapstone ? "C" : p.isStanding ? "S" : "")
        )
        .join("");
    return {
      ply: last ? last.text : null,
      held: game.board.selected.pieces.length,
      f5: stack("f5"),
      f6: stack("f6"),
    };
  });

test.describe("Capstone stack smashing a wall", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.waitForFunction(() => window.app && window.app.$store, {
      timeout: 30000,
    });
    await load(page);
  });

  test("a flat before the wall still drops everything but the capstone", async ({
    page,
  }) => {
    await click(page, ["f2", "f3", "f4"]);
    expect((await result(page)).held).toBe(1);
  });

  test("clicking up to the wall smashes it with the capstone alone", async ({
    page,
  }) => {
    await click(page, ["f2", "f3", "f4", "f5"]);
    const r = await result(page);
    expect(r.ply).toBe("4f2+121*");
    expect(r.f5).toBe("1121C");
    expect(r.f6).toBe("1");
  });

  test("dropping more earlier still ends in a legal smash", async ({
    page,
  }) => {
    await click(page, ["f2", "f3", "f3", "f4", "f5"]);
    expect((await result(page)).ply).toBe("4f2+211*");
  });

  test("dropping at the origin first still ends in a legal smash", async ({
    page,
  }) => {
    await click(page, ["f2", "f2", "f3", "f4", "f5"]);
    expect((await result(page)).ply).toBe("3f2+111*");
  });

  test("a smash that drops more than one piece on the wall is rejected", async ({
    page,
  }) => {
    const r = await page.evaluate(async () => {
      const game = window.app.$game;
      const before = game.plies.filter(Boolean).length;
      let error = null;
      try {
        await window.app.$store.dispatch("game/INSERT_PLY", "4f2+112*");
      } catch (e) {
        error = e.message;
      }
      return { error, added: game.plies.filter(Boolean).length - before };
    });
    expect(r.added).toBe(0);
  });

  test("the wall is not a target while more than the capstone is held", async ({
    page,
  }) => {
    await click(page, ["f2", "f3"]);
    // Hotkey drops skip the auto-drop, so this reaches f4 holding 2.
    const r = await page.evaluate(async () => {
      const store = window.app.$store;
      const board = window.app.$game.board;
      await store.dispatch("game/SELECT_DROP_PIECES", {
        square: "f4",
        count: 1,
      });
      const held = board.selected.pieces.length;
      const wallValid = board.isValidSquare(board.getSquare("f5"));
      // Repeated hotkeys onto the wall whittle the selection down first.
      await store.dispatch("game/SELECT_DROP_PIECES", {
        square: "f5",
        count: 1,
      });
      await store.dispatch("game/SELECT_DROP_PIECES", {
        square: "f5",
        count: 1,
      });
      return { held, wallValid };
    });
    expect(r.held).toBe(2);
    expect(r.wallValid).toBe(false);
    expect((await result(page)).ply).toBe("4f2+121*");
  });
});
