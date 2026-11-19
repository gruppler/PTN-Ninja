// @ts-check
// Where the board comes to rest when its space is resized, in 2D and 2.5D,
// and how it gets there: in one pass.
const fs = require("fs");
const path = require("path");
const { test, expect, loadPTN } = require("./helpers");

const setUI = (page, key, value) =>
  page.evaluate(
    ([key, value]) => window.app.$store.dispatch("ui/SET_UI", [key, value]),
    [key, value]
  );

test.describe.configure({ timeout: 180000 });

// Where the board rested, in every case below, before it was sized in one
// pass. RECORD_BOARD_RESIZE=1 writes it anew from what the board does now
// (or =<file> writes it there). A case may have another recording's outcome
// as its `alternative`, and either will do.
const FIXTURE = path.join(__dirname, "fixtures", "board-resize.json");
// What is compared of each case
const PARTS = ["board", "container", "square", "stone", "unplayed"];

const BASE = { width: 1280, height: 720 };
// The last is narrow enough for the vertical layout
const WINDOWS = [
  { width: 1280, height: 720 },
  { width: 900, height: 640 },
  { width: 560, height: 800 },
];
const SIZES = [3, 5, 6, 8];
// [unplayed pieces, axis labels: "frame" | "board" | "off"]
const OPTIONS = [
  [true, "frame"],
  [false, "board"],
  [true, "off"],
  [false, "frame"],
  [true, "board"],
  [false, "off"],
];
const VIEWS = [
  { name: "2d", view: "2d" },
  { name: "2.5d", view: "2.5d", rotation: [0, 0.65], orthographic: false },
  {
    name: "2.5d-ortho",
    view: "2.5d",
    rotation: [0.6, 0.9],
    orthographic: true,
  },
];

const choose = (page, view) => setUI(page, "board3D", view === "2.5d");
// Board, as window.__board
const findBoard = (page) =>
  page.evaluate(() => {
    const walk = (vm) =>
      vm.$options.name === "Board" ? vm : vm.$children.map(walk).find(Boolean);
    window.__board = walk(window.app);
    return Boolean(window.__board);
  });

// The board as it is shown: the DOM board's box, a square's and a stone's
// (one on the board and one unplayed, if shown)
const where = (page) =>
  page.evaluate(() => {
    const round = (v) => Math.round(v * 100) / 100;
    const box = (el) => {
      if (!el) return null;
      const b = el.getBoundingClientRect();
      return [b.left, b.top, b.width, b.height].map(round);
    };
    return {
      board: box(document.querySelector(".board")),
      container: box(document.querySelector(".board-container")),
      square: box(document.querySelector(".square")),
      stone: box(
        document.querySelector(".board .stone:not(.unplayed):not(.outline)")
      ),
      unplayed: box(document.querySelector(".stone.unplayed")),
    };
  });

// Waits until the board has stayed where it is for a while, with nothing
// left to come (a fit waiting for its timer)
const rest = async (page) => {
  let last = null;
  let still = 0;
  await expect
    .poll(
      async () => {
        const now = JSON.stringify(
          await page.evaluate(() => {
            const B = window.__board;
            const c = document.querySelector(".board-container");
            const b = document.querySelector(".board").getBoundingClientRect();
            return [
              B.zoomFitTimer === null,
              getComputedStyle(c).transform,
              getComputedStyle(c).width,
              b.left,
              b.top,
              b.width,
              b.height,
            ];
          })
        );
        still = now === last ? still + 1 : 0;
        last = now;
        return still >= 3 && JSON.parse(now)[0];
      },
      { timeout: 30000, intervals: [400] }
    )
    .toBe(true);
};

const setOptions = async (page, [unplayed, labels]) => {
  await setUI(page, "unplayedPieces", unplayed);
  await setUI(page, "axisLabels", labels !== "off");
  await setUI(page, "axisLabelsSmall", labels === "board");
};

const resetUI = async (page) => {
  await page.setViewportSize(BASE);
  await choose(page, "2d");
  await setUI(page, "perspective", 5);
  await setUI(page, "boardRotation", [0, 0.65]);
  await setUI(page, "unplayedPieces", true);
  await setUI(page, "axisLabels", true);
  await setUI(page, "axisLabelsSmall", true);
};

test.afterEach(async ({ page }) => {
  await resetUI(page);
});

test("the board rests where it did after a resize", async ({ page }) => {
  // 12 cases in 3 views, each set up and resized
  test.setTimeout(1200000);
  const record = Boolean(process.env.RECORD_BOARD_RESIZE);
  const expected = record ? {} : JSON.parse(fs.readFileSync(FIXTURE, "utf8"));
  const found = {};
  await setUI(page, "showPTN", false);
  await setUI(page, "showText", false);
  let i = 0;
  for (const win of WINDOWS) {
    for (const size of SIZES) {
      const options = OPTIONS[i++ % OPTIONS.length];
      await page.setViewportSize(BASE);
      await loadPTN(page, `[Size "${size}"]\n\n1. a1 b2 2. b1`);
      await findBoard(page);
      await setOptions(page, options);
      for (const v of VIEWS) {
        const key = `${win.width}x${win.height} size ${size} ${options.join(
          " "
        )} ${v.name}`;
        await page.setViewportSize(BASE);
        if (v.rotation) {
          await page.evaluate(
            (r) => (window.__board.boardRotation = r),
            v.rotation
          );
          await setUI(page, "boardRotation", v.rotation);
          await setUI(page, "perspective", v.orthographic ? 0 : 5);
        }
        await choose(page, v.view);
        await rest(page);
        await page.setViewportSize(win);
        await rest(page);
        found[key] = await where(page);
        // The square size boardSize.js gave the board is the one it has,
        // and Board's own check never found otherwise
        const squareSize = await page.evaluate(() => [
          window.__board.squareSize,
          document.querySelector(".board").offsetWidth,
          window.__board.squareSizeMisses,
        ]);
        if (!record) {
          // A number: undefined would mean the check never ran here
          expect(typeof squareSize[2], `${key} square size misses`).toBe(
            "number"
          );
          expect(squareSize[2], `${key} square size misses`).toBe(0);
        }
        expect(
          Math.abs(squareSize[0] - squareSize[1]),
          `${key} square size ${squareSize}`
        ).toBeLessThanOrEqual(1);
        // Every part within a pixel of where the old board rested
        const near = 1;
        if (!record) {
          // Every part within `near` px of where the old board rested, or
          // of its other outcome
          const off = (outcome) => {
            for (const part of PARTS) {
              const a = found[key][part];
              const b = outcome[part];
              if (!a || !b) {
                if (a !== b) return `${part}: ${a} against ${b}`;
                continue;
              }
              const bad = a.findIndex((v, j) => Math.abs(v - b[j]) > near);
              if (bad >= 0) return `${part}[${bad}]: ${a} against ${b}`;
            }
            return null;
          };
          const outcomes = [expected[key], expected[key].alternative].filter(
            Boolean
          );
          const misses = outcomes.map(off);
          expect(
            misses.some((miss) => miss === null),
            `${key}: ${misses.join("; or ")}`
          ).toBe(true);
        }
        await choose(page, "2d");
      }
    }
  }
  if (record) {
    // Or to the file it names
    const file =
      process.env.RECORD_BOARD_RESIZE === "1"
        ? FIXTURE
        : process.env.RECORD_BOARD_RESIZE;
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify(found, null, 1) + "\n");
  }
});

// Records, at the start of every frame until stopped, the DOM board's size
// as shown
const startSizes = (page) =>
  page.evaluate(() => {
    const sampling = { on: true, sizes: [] };
    window.__sizes = sampling;
    const frame = () => {
      if (!sampling.on) return;
      const b = document.querySelector(".board").getBoundingClientRect();
      sampling.sizes.push([b.width, b.height]);
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  });
// How many frames showed the board at another size than the frame before
const stopSizes = (page) =>
  page.evaluate(() => {
    const sampling = window.__sizes;
    sampling.on = false;
    let changes = 0;
    sampling.sizes.forEach(([w, h], i) => {
      const [pw, ph] = sampling.sizes[i - 1] || [w, h];
      if (Math.abs(w - pw) > 0.5 || Math.abs(h - ph) > 0.5) changes++;
    });
    return { changes, frames: sampling.sizes.length };
  });

for (const v of [VIEWS[0], VIEWS[1]]) {
  test(`in ${v.name}, the drawer opening resizes the board once`, async ({
    page,
  }) => {
    // Narrow enough that the drawer leaves the board less width
    await page.setViewportSize({ width: 900, height: 720 });
    await setUI(page, "showPTN", false);
    await setUI(page, "showText", false);
    await loadPTN(page, '[Size "6"]\n\n1. a1 f6 2. b1 e6 3. b2 Sd3');
    await findBoard(page);
    if (v.rotation) {
      await setUI(page, "boardRotation", v.rotation);
      await setUI(page, "perspective", v.orthographic ? 0 : 5);
    }
    await choose(page, v.view);
    await rest(page);
    for (const open of [true, false]) {
      const before = await where(page);
      await startSizes(page);
      await setUI(page, "showPTN", open);
      await rest(page);
      const { changes, frames } = await stopSizes(page);
      const after = await where(page);
      // It did change size, and only once
      expect(after.board[2]).not.toBeCloseTo(before.board[2], 0);
      expect(frames).toBeGreaterThan(5);
      expect(changes, `drawer ${open ? "opening" : "closing"}`).toBe(1);
    }
  });
}

for (const v of [VIEWS[0], VIEWS[1]]) {
  test(`in ${v.name}, a space that never stops changing still re-fits the board`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 900, height: 720 });
    await setUI(page, "showPTN", false);
    await setUI(page, "showText", false);
    await loadPTN(page, '[Size "6"]\n\n1. a1 f6 2. b1 e6 3. b2 Sd3');
    await findBoard(page);
    if (v.rotation) {
      await setUI(page, "boardRotation", v.rotation);
      await setUI(page, "perspective", v.orthographic ? 0 : 5);
    }
    await choose(page, v.view);
    await rest(page);
    try {
      // The space made 4px shorter in every frame, 50 frames running, as a
      // window dragged without a pause would; meanwhile, every frame, the
      // board's size
      const { sizes, applied } = await page.evaluate(
        () =>
          new Promise((resolve) => {
            const space = document.querySelector(".board-space");
            const sizes = [];
            let step = 0;
            const frame = () => {
              const b = document
                .querySelector(".board")
                .getBoundingClientRect();
              sizes.push([b.width, b.height]);
              if (step < 50) {
                space.style.bottom = 4 * ++step + "px";
                requestAnimationFrame(frame);
              } else {
                resolve({
                  sizes,
                  applied: window.__board.space.height,
                });
              }
            };
            requestAnimationFrame(frame);
          })
      );
      let changes = 0;
      sizes.forEach(([w, h], i) => {
        const [pw, ph] = sizes[i - 1] || [w, h];
        if (Math.abs(w - pw) > 0.5 || Math.abs(h - ph) > 0.5) changes++;
      });
      // It was re-fitted on the way, not only at the end
      expect(changes, JSON.stringify(sizes)).toBeGreaterThanOrEqual(2);
      expect(applied).toBeLessThan(502);
    } finally {
      await page.evaluate(
        () => (document.querySelector(".board-space").style.bottom = "")
      );
      await rest(page);
    }
  });
}
