// @ts-check
const { test, expect } = require("@playwright/test");
const { compressToEncodedURIComponent: compress } = require("lz-string");
const fs = require("fs");

/**
 * The last move can be shown by outlining the pieces it moved, in place of
 * highlighting its squares. Each of those pieces gets a ring of its own, drawn
 * on top of it at its edge, with the piece's border going on inside the ring
 * to meet the fill, so that it never covers the pieces beneath.
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

// Ends with a stack topped by a standing stone spread onto two stacks
const WALL_PTN = `[Size "6"]
[TPS "x6/x2,2,x3/x2,12,x3/x2,2121S,x3/x,1,x,2C,x2/x6 1 10"]

10. 3c3+12`;

const setUI = (page, key, value) =>
  page.evaluate(
    ([key, value]) => window.app.$store.dispatch("ui/SET_UI", [key, value]),
    [key, value]
  );

/**
 * The pieces wearing a ring, as "<square> z<index in stack>", bottom to top
 * within each square.
 */
const ringed = (page) =>
  page.evaluate(() =>
    [...document.querySelectorAll(".piece")]
      .filter((el) => el.querySelector(".stone.ring"))
      .map((el) => el.__vue__.piece)
      .sort((a, b) => a.square.localeCompare(b.square) || a.z - b.z)
      .map((piece) => piece.square + " z" + piece.z)
  );

/**
 * Each ring with its piece, in CSS pixels: whether it covers exactly the
 * piece's box; how thick it is (where the border layer inside it starts) and
 * how far in the border goes on to the fill (where the fill layer starts);
 * the corners of the ring, its piece, its border layer and its fill layer;
 * and the piece's border width.
 */
const ringGeometry = (page) =>
  page.evaluate(() =>
    [...document.querySelectorAll(".stone.ring")].map((ring) => {
      const pieceEl = ring.closest(".piece");
      const stone = pieceEl.querySelector(".stone:not(.ring)");
      const piece = pieceEl.__vue__.piece;
      const border = getComputedStyle(ring, "::before");
      const fill = getComputedStyle(ring, "::after");
      const box = (el) => {
        const { x, y, width, height } = el.getBoundingClientRect();
        return [x, y, width, height].map((n) => n.toFixed(2)).join();
      };
      const corner = (style) => parseFloat(style.borderTopLeftRadius);
      const square = pieceEl.getBoundingClientRect().width;
      const { vars } = window.app.$store.state.ui.theme;
      return {
        id: piece.square + " z" + piece.z,
        isCapstone: piece.isCapstone,
        isStanding: piece.isStanding,
        sameBox: box(ring) === box(stone),
        width: parseFloat(getComputedStyle(stone).width),
        border: vars["piece-border-width"] * 0.013 * square,
        thickness: parseFloat(border.top),
        borderReach: parseFloat(fill.top),
        corners: {
          ring: corner(getComputedStyle(ring)),
          piece: corner(getComputedStyle(stone)),
          border: corner(border),
          fill: corner(fill),
        },
        square,
      };
    })
  );

// A ring is as thick as 0.025 of a square, but at least 2px
const expectThickness = (thickness, square, id) =>
  expect(thickness, id).toBeCloseTo(Math.max(2, square * 0.025), 1);

// A ring's corners are concentric with its fill's, which are an unringed
// piece's: 0.05 of a square less the border. The piece under it takes the
// ring's outer corners.
const expectCorners = (ring) => {
  if (ring.isCapstone) {
    return;
  }
  const fill = Math.max(0, ring.square * 0.05 - ring.border);
  const band = ring.borderReach - ring.thickness;
  expect(ring.corners.fill, ring.id).toBeCloseTo(fill, 1);
  expect(ring.corners.border, ring.id).toBeCloseTo(fill + band, 1);
  expect(ring.corners.ring, ring.id).toBeCloseTo(fill + ring.borderReach, 1);
  expect(ring.corners.piece, ring.id).toBeCloseTo(ring.corners.ring, 1);
};

const setBorderWidth = (page, width) =>
  page.evaluate((width) => {
    const { state, dispatch } = window.app.$store;
    const theme = JSON.parse(JSON.stringify(state.ui.theme));
    theme.id = "test-border-" + width;
    theme.vars["piece-border-width"] = width;
    return dispatch("ui/SET_THEME", theme);
  }, width);

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
  await expect.poll(() => ringed(page)).toEqual([]);
  expect(await squaresAreHighlighted(page)).toBe(true);
});

test("rings each piece the ply moved", async ({ page }) => {
  await setUI(page, "highlightSquares", true);
  await setUI(page, "highlightPieces", true);
  await expect
    .poll(() => ringed(page))
    .toEqual(["c4 z3", "c5 z0", "c6 z1", "c6 z2", "c6 z3"]);
  // Nothing is drawn around or behind the pieces any more
  expect(await page.locator(".stone.outline").count()).toBe(0);
});

for (const borderWidth of [1, 2, 6]) {
  test(`a ring sits at the piece's edge, the border going on inside it to the fill (border ${borderWidth})`, async ({
    page,
  }) => {
    await setUI(page, "highlightPieces", true);
    await setBorderWidth(page, borderWidth);
    await expect.poll(async () => (await ringGeometry(page)).length).toBe(5);
    for (const ring of await ringGeometry(page)) {
      expect(ring.sameBox, ring.id).toBe(true);
      expectThickness(ring.thickness, ring.square, ring.id);
      // What's left of the border, but at least a pixel of it
      const left = Math.max(
        Math.min(1, ring.border),
        ring.border - ring.thickness
      );
      expect(ring.borderReach, ring.id).toBeCloseTo(ring.thickness + left, 1);
      expectCorners(ring);
    }
  });
}

test("a ring meets the fill when the theme draws no border", async ({
  page,
}) => {
  await setUI(page, "highlightPieces", true);
  await setBorderWidth(page, 0);
  await expect.poll(async () => (await ringGeometry(page)).length).toBe(5);
  for (const ring of await ringGeometry(page)) {
    expect(ring.sameBox, ring.id).toBe(true);
    expectThickness(ring.thickness, ring.square, ring.id);
    expect(ring.borderReach, ring.id).toBeCloseTo(ring.thickness, 1);
    expectCorners(ring);
  }
});

test("a piece's corners don't ease as its ring comes and goes", async ({
  page,
}) => {
  await setUI(page, "animateBoard", true);
  await setUI(page, "highlightPieces", true);
  await expect.poll(() => ringed(page)).toContain("c5 z0");
  await page.waitForTimeout(500);
  for (const on of [false, true]) {
    const corners = await page.evaluate(async (on) => {
      const stone = [...document.querySelectorAll(".piece")]
        .find((el) => el.__vue__.piece.square === "c5")
        .querySelector(".stone");
      const corner = () => getComputedStyle(stone).borderTopLeftRadius;
      const before = corner();
      window.app.$store.dispatch("ui/SET_UI", ["highlightPieces", on]);
      const after = [];
      for (let i = 0; i < 6; i++) {
        await new Promise((resolve) => requestAnimationFrame(resolve));
        after.push(corner());
      }
      return { before, after };
    }, on);
    expect(corners.after[0], `highlight ${on}`).not.toBe(corners.before);
    expect(new Set(corners.after).size, `highlight ${on}`).toBe(1);
  }
});

test("a standing stone's ring leaves a third of it unringed", async ({
  page,
}) => {
  test.setTimeout(60000);
  await setUI(page, "highlightPieces", true);
  // Shrink the board until the 2px minimum would eat into the stone
  await page.setViewportSize({ width: 360, height: 640 });
  await page.goto("/" + compress(WALL_PTN));
  await page.waitForFunction(() => window.app && window.app.$store, null, {
    timeout: 30000,
  });
  await page.waitForSelector(".stone");
  await setUI(page, "animateBoard", false);
  await setUI(page, "board3D", false);
  await setUI(page, "highlightPieces", true);
  await page.evaluate(() => window.app.$store.dispatch("game/LAST"));
  await expect
    .poll(async () =>
      (await ringGeometry(page)).filter(({ isStanding }) => isStanding)
    )
    .toHaveLength(1);
  const [wall] = (await ringGeometry(page)).filter(
    ({ isStanding }) => isStanding
  );
  expect(wall.sameBox).toBe(true);
  expect(wall.square * 0.025).toBeLessThan(2);
  expect(wall.width - 2 * wall.thickness).toBeGreaterThanOrEqual(
    wall.width / 3 - 0.01
  );
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
    .poll(() => ringed(page))
    .toEqual(["c3 z0", "c3 z1", "c3 z2", "c3 z3", "c3 z4"]);
});

// The outlines drawn in an exported SVG: where each one's middle is, top to
// bottom of the image, and how tall it is
const drawnOutlines = (page, svg) =>
  page.evaluate((svg) => {
    const host = document.createElement("div");
    host.style.cssText = "position:absolute;left:0;top:0;opacity:0";
    host.innerHTML = svg;
    document.body.append(host);
    // A ring is drawn in the primary color right after its piece, which
    // casts a shadow
    const { primary } = window.app.$store.state.ui.theme.colors;
    const drawn = [...host.querySelectorAll(`[fill="${primary}"]`)]
      .filter((el) => {
        const piece = el.parentElement.previousElementSibling;
        return piece && piece.hasAttribute("filter");
      })
      .map((el) => {
        const { y, height } = el.getBoundingClientRect();
        return { y: y + height / 2, height };
      });
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

test("rings each piece the ply moved on the 3D board", async ({ page }) => {
  await setUI(page, "highlightPieces", true);
  await setUI(page, "board3D", true);
  await expect
    .poll(() => ringed(page))
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
