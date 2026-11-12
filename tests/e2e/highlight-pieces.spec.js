// @ts-check
const { test, expect } = require("@playwright/test");
const { compressToEncodedURIComponent: compress } = require("lz-string");
const fs = require("fs");

/**
 * The last move can be shown by outlining the pieces it moved, in place of
 * highlighting its squares. On the 2D board the pieces that landed on a square
 * share one outline, so the lowest of them draws an outline for each, behind
 * the whole group.
 */

// Ends with a stack spread over three squares: one piece onto c4's stack, one
// onto the empty c5, and three (a capstone on top) onto c6
const PTN = `[Size "6"]
[Komi "2"]

1. a1 f1 2. e3 e4 3. d3 b3 4. Cc4 b4 5. c3 b5 6. c5 b2 7. b6 b1 8. c2 a5
9. c4< Cc4 10. d4 d5 11. f3 Sd2 12. e5 f4 13. a2 b3> 14. b3 c1 15. f2 d2+
16. f5 c6 17. e6 2d3> 18. d2 b5> 19. b3- e2 20. b5 e2< 21. c2+ Sc2 22. a6 c2+
23. 2b4+ c4+ 24. Sc2 c4 25. d6 f6 26. d1 b4 27. 3b5- c5- 28. e2 b5
29. 4b4+ c4+ 30. a3 a4 31. d3 b3 32. f3+ e4> 33. Se4 3f4-12 34. e2> f3-
35. e1 Se2 36. f4 2c3> 37. 5b5-32 3c5-21 38. b5 c3-* 39. 3b3> 2c2<
40. 5c3+113`;

const setUI = (page, key, value) =>
  page.evaluate(
    ([key, value]) => window.app.$store.dispatch("ui/SET_UI", [key, value]),
    [key, value]
  );

/**
 * The outlines on the board, as "<square> z<index in stack>" of the piece
 * drawing them, mapped to the pieces they outline, bottom to top. Each
 * outline is matched to its piece by position, so this also checks that it
 * sits exactly behind that piece.
 */
const outlines = (page) =>
  page.evaluate(() => {
    const rect = (el) => {
      const { x, y, width, height } = el.getBoundingClientRect();
      return [x, y, width, height].map((n) => Math.round(n * 2) / 2).join();
    };
    const pieces = [...document.querySelectorAll(".piece")].map((el) => ({
      el,
      piece: el.__vue__.piece,
    }));
    const stoneAt = {};
    pieces.forEach(({ el, piece }) => {
      if (piece.square) {
        stoneAt[rect(el.querySelector(".stone:not(.outline)"))] =
          piece.square + " z" + piece.z;
      }
    });
    const result = {};
    pieces.forEach(({ el, piece }) => {
      const drawn = [...el.querySelectorAll(".stone.outline")];
      if (drawn.length) {
        result[piece.square + " z" + piece.z] = drawn.map(
          (outline) => stoneAt[rect(outline)] || "nothing"
        );
      }
    });
    return result;
  });

const squaresAreHighlighted = (page) =>
  page.evaluate(() =>
    document
      .querySelector(".board-container")
      .classList.contains("highlight-squares")
  );

test.beforeEach(async ({ page }) => {
  await page.goto("/" + compress(PTN));
  await page.waitForFunction(() => window.app && window.app.$store, null, {
    timeout: 30000,
  });
  await page.waitForSelector(".stone");
  // Positions are compared exactly, so nothing may still be sliding
  await setUI(page, "animateBoard", false);
  await setUI(page, "board3D", false);
  await page.evaluate(() => window.app.$store.dispatch("game/LAST"));
  await expect
    .poll(() =>
      page.evaluate(() => {
        const { ply, plyIsDone } = window.app.$store.state.game.position;
        return ply && ply.text + (plyIsDone ? " done" : "");
      })
    )
    .toBe("5c3+113 done");
});

test("outlines nothing while the setting is off", async ({ page }) => {
  await setUI(page, "highlightPieces", false);
  await setUI(page, "highlightSquares", true);
  await expect.poll(() => outlines(page)).toEqual({});
  expect(await squaresAreHighlighted(page)).toBe(true);
});

test("outlines the pieces a ply moved, one group per square", async ({
  page,
}) => {
  await setUI(page, "highlightSquares", true);
  await setUI(page, "highlightPieces", true);
  await expect
    .poll(() => outlines(page))
    .toEqual({
      "c4 z3": ["c4 z3"],
      "c5 z0": ["c5 z0"],
      "c6 z1": ["c6 z1", "c6 z2", "c6 z3"],
    });
});

test("takes the place of square highlights", async ({ page }) => {
  await setUI(page, "highlightSquares", true);
  await setUI(page, "highlightPieces", true);
  await expect.poll(() => squaresAreHighlighted(page)).toBe(false);
  await setUI(page, "highlightPieces", false);
  await expect.poll(() => squaresAreHighlighted(page)).toBe(true);
});

test("outlines the pieces about to move when the ply is undone", async ({
  page,
}) => {
  await setUI(page, "highlightPieces", true);
  await page.evaluate(() =>
    window.app.$store.dispatch("game/PREV", { half: true })
  );
  await expect
    .poll(() =>
      page.evaluate(() => window.app.$store.state.game.position.plyIsDone)
    )
    .toBe(false);
  // The five pieces it carries are back on c3, which holds nothing else
  await expect
    .poll(() => outlines(page))
    .toEqual({
      "c3 z0": ["c3 z0", "c3 z1", "c3 z2", "c3 z3", "c3 z4"],
    });
});

// The outlines drawn in an exported SVG: where each one's middle is, top to
// bottom of the image, and how tall it is
const drawnOutlines = (page, svg) =>
  page.evaluate((svg) => {
    const host = document.createElement("div");
    host.style.cssText = "position:absolute;left:0;top:0;opacity:0";
    host.innerHTML = svg;
    document.body.append(host);
    const drawn = [...host.querySelectorAll('[fill="none"][stroke]')].map(
      (el) => {
        const { y, height } = el.getBoundingClientRect();
        return { y: y + height / 2, height };
      }
    );
    host.remove();
    return drawn;
  }, svg);

// The pieces of one stack overlap; pieces on different squares don't
const expectOneStackOf = (drawn, count) => {
  expect(drawn).toHaveLength(count);
  const middles = drawn.map(({ y }) => y);
  expect(Math.max(...middles) - Math.min(...middles)).toBeLessThan(
    drawn[0].height
  );
};

const exportWithOutlinesUndone = async (page) => {
  await page.evaluate(() => {
    const { state, dispatch } = window.app.$store;
    return dispatch("ui/SET_UI", [
      "pngConfig",
      {
        ...state.ui.pngConfig,
        svgFormat: true,
        highlightPieces: true,
        highlightSquares: false,
      },
    ]);
  });
  await page.evaluate(() =>
    window.app.$store.dispatch("game/PREV", { half: true })
  );
  await expect
    .poll(() =>
      page.evaluate(() => window.app.$store.state.game.position.plyIsDone)
    )
    .toBe(false);
};

test("an exported image outlines the pieces about to move when the ply is undone", async ({
  page,
}) => {
  await exportWithOutlinesUndone(page);
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.evaluate(() => {
      window.app.$store.dispatch("game/EXPORT_PNG");
    }),
  ]);
  const svg = fs.readFileSync(await download.path(), "utf8");
  // The five pieces the ply carries are back on c3, as on the board
  expectOneStackOf(await drawnOutlines(page, svg), 5);
});

test("the export dialog's preview outlines the pieces about to move when the ply is undone", async ({
  page,
}) => {
  await exportWithOutlinesUndone(page);
  await page.evaluate(() => {
    window.app.$router.push("/image");
  });
  const preview = page.locator(".q-dialog .svg-preview svg");
  await preview.waitFor();
  const svg = await page
    .locator(".q-dialog .svg-preview")
    .evaluate((el) => el.innerHTML);
  expectOneStackOf(await drawnOutlines(page, svg), 5);
});

test("gives each piece its own outline on the 3D board", async ({ page }) => {
  await setUI(page, "highlightPieces", true);
  await setUI(page, "board3D", true);
  await expect
    .poll(async () => Object.keys(await outlines(page)).sort())
    .toEqual(["c4 z3", "c5 z0", "c6 z1", "c6 z2", "c6 z3"]);
});

// Pick an option of the Highlight Last Move select within `root`
const chooseHighlight = async (page, root, option) => {
  await root.locator(".q-select", { hasText: "Highlight Last Move" }).click();
  await page
    .locator(".q-menu .q-item", { hasText: new RegExp(`^${option}$`) })
    .click();
};

const flags = (page, config) =>
  page.evaluate((config) => {
    const ui = window.app.$store.state.ui;
    const { highlightPieces, highlightSquares } = config ? ui[config] : ui;
    return { highlightPieces, highlightSquares };
  }, config);

test("Settings offers squares, pieces or none as one choice", async ({
  page,
}) => {
  await setUI(page, "highlightPieces", false);
  await setUI(page, "highlightSquares", true);
  await page.evaluate(() => {
    window.app.$router.push("/settings/board");
  });
  const dialog = page.locator(".q-dialog");
  const select = dialog.locator(".q-select", {
    hasText: "Highlight Last Move",
  });
  await expect(select).toContainText("Squares");

  await chooseHighlight(page, dialog, "Pieces");
  await expect
    .poll(() => flags(page))
    .toEqual({ highlightPieces: true, highlightSquares: false });
  await expect(select).toContainText("Pieces");

  await chooseHighlight(page, dialog, "None");
  await expect
    .poll(() => flags(page))
    .toEqual({ highlightPieces: false, highlightSquares: false });

  await chooseHighlight(page, dialog, "Squares");
  await expect
    .poll(() => flags(page))
    .toEqual({ highlightPieces: false, highlightSquares: true });
});

for (const [route, config] of [
  ["image", "pngConfig"],
  ["gif", "gifConfig"],
]) {
  test(`${route} dialog offers squares, pieces or none as one choice`, async ({
    page,
  }) => {
    await page.evaluate((route) => {
      window.app.$router.push("/" + route);
    }, route);
    const dialog = page.locator(".q-dialog");
    await dialog.locator(".q-select").first().waitFor();

    await chooseHighlight(page, dialog, "Pieces");
    await expect
      .poll(() => flags(page, config))
      .toEqual({ highlightPieces: true, highlightSquares: false });

    await chooseHighlight(page, dialog, "None");
    await expect
      .poll(() => flags(page, config))
      .toEqual({ highlightPieces: false, highlightSquares: false });

    await chooseHighlight(page, dialog, "Squares");
    await expect
      .poll(() => flags(page, config))
      .toEqual({ highlightPieces: false, highlightSquares: true });
  });
}
