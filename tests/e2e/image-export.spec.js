// @ts-check
const { test, expect } = require("@playwright/test");
const { compressToEncodedURIComponent: compress } = require("lz-string");
const fs = require("fs");

/**
 * The image of a position is made three ways: the quick download, the export
 * dialog and the image link. All three are built from one set of options
 * (src/utils/imageExport.js), so they draw the same picture.
 */

const PTN = `[Size "5"]

1. a1 e5 2. c3 Sc4 3. Cd3 a2 4. d3< b2 5. 2c3<11`;

const setUI = (page, key, value) =>
  page.evaluate(
    ([key, value]) => window.app.$store.dispatch("ui/SET_UI", [key, value]),
    [key, value]
  );

// Change some of the image settings, keeping the rest. Vector output, so the
// images can be compared as text
const setImageConfig = (page, changes = {}) =>
  page.evaluate((changes) => {
    const { state, dispatch } = window.app.$store;
    return dispatch("ui/SET_UI", [
      "pngConfig",
      { ...state.ui.pngConfig, svgFormat: true, ...changes },
    ]);
  }, changes);

// An SVG as the browser writes it back out, so two can be compared however
// each was produced
const normalized = (page, svg) =>
  page.evaluate((svg) => {
    const host = document.createElement("div");
    host.innerHTML = svg;
    return host.innerHTML;
  }, svg);

const downloaded = async (page) => {
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.evaluate(() => {
      window.app.$store.dispatch("game/EXPORT_PNG");
    }),
  ]);
  return normalized(page, fs.readFileSync(await download.path(), "utf8"));
};

const previewed = async (page) => {
  await page.evaluate(() => {
    window.app.$router.push("/image");
  });
  const preview = page.locator(".q-dialog .svg-preview");
  await preview.locator("svg").waitFor();
  const svg = await preview.evaluate((el) => el.innerHTML);
  await page.evaluate(() => {
    window.app.$router.back();
  });
  await expect(page.locator(".q-dialog")).toHaveCount(0);
  return normalized(page, svg);
};

const linkParams = (page) =>
  page.evaluate(() => {
    const url = new URL(window.app.$store.getters["ui/png_url"]());
    return Object.fromEntries(url.searchParams.entries());
  });

const position = (page) =>
  page.evaluate(() => {
    const { ply, plyIsDone, tps } = window.app.$store.state.game.position;
    return { text: ply.text, tpsBefore: ply.tpsBefore, plyIsDone, tps };
  });

const undoPly = async (page) => {
  await page.evaluate(() =>
    window.app.$store.dispatch("game/PREV", { half: true })
  );
  await expect.poll(async () => (await position(page)).plyIsDone).toBe(false);
};

test.beforeEach(async ({ page }) => {
  await page.goto("/" + compress(PTN));
  await page.waitForFunction(() => window.app && window.app.$store, null, {
    timeout: 30000,
  });
  await page.waitForSelector(".stone");
  await setUI(page, "animateBoard", false);
  await page.evaluate(() => window.app.$store.dispatch("game/LAST"));
  await expect.poll(async () => (await position(page)).text).toBe("2c3<11");
  await setImageConfig(page);
});

test("the dialog and the quick download draw the same image", async ({
  page,
}) => {
  expect(await previewed(page)).toBe(await downloaded(page));

  // With the last ply not yet played, and its pieces outlined
  await setImageConfig(page, {
    highlightPieces: true,
    highlightSquares: false,
  });
  await undoPly(page);
  expect(await previewed(page)).toBe(await downloaded(page));
});

test("both follow the board's rotation", async ({ page }) => {
  const upright = await downloaded(page);
  await setUI(page, "boardTransform", [1, 0]);
  const rotated = await downloaded(page);
  expect(rotated).not.toBe(upright);
  expect(await previewed(page)).toBe(rotated);
});

test("an image link carries the position the image is drawn from", async ({
  page,
}) => {
  // A ply that has been played: the position before it, and the ply
  let at = await position(page);
  let params = await linkParams(page);
  expect(params.tps).toBe(at.tpsBefore);
  expect(params.ply).toBe(at.text);
  expect(params.hl).toBeUndefined();
  expect(params.plyIsDone).toBeUndefined();

  // Outlining the pieces takes the place of highlighting the squares
  await setImageConfig(page, {
    highlightPieces: true,
    highlightSquares: false,
  });
  params = await linkParams(page);
  expect(params.hlPieces).toBe("true");
  expect(params.hlSquares).toBe("false");

  // A ply not yet played: the position as it stands, and the ply to mark
  await undoPly(page);
  at = await position(page);
  params = await linkParams(page);
  expect(params.tps).toBe(at.tps);
  expect(params.hl).toBe(at.text);
  expect(params.plyIsDone).toBe("false");
  expect(params.ply).toBeUndefined();

  // No highlight at all
  await setImageConfig(page, {
    highlightPieces: false,
    highlightSquares: false,
  });
  params = await linkParams(page);
  expect(params.hl).toBeUndefined();
  expect(params.hlSquares).toBe("false");
  expect(params.hlPieces).toBeUndefined();
});

test("an image link leaves out what the renderer assumes", async ({ page }) => {
  // Stack counts are off in the app unless turned on, and on in the renderer
  expect((await linkParams(page)).stackCounts).toBe("false");

  // With every setting as the renderer assumes it, a link is only the
  // position, the file's name and the theme
  await setImageConfig(page, { stackCounts: true });
  expect(Object.keys(await linkParams(page)).sort()).toEqual([
    "name",
    "ply",
    "theme",
    "tps",
  ]);

  await setImageConfig(page, { axisLabels: false, imageSize: "lg" });
  const changed = await linkParams(page);
  expect(changed.axisLabels).toBe("false");
  expect(changed.imageSize).toBe("lg");
});
