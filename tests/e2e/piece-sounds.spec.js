// @ts-check
const { test, expect, loadPTN } = require("./helpers");

/**
 * The synthesized sounds of pieces landing match the prototype's, sample for
 * sample. Each expected row is the prototype's output for the same seed:
 * [samples, peak, rms, sample 300, sample 1500].
 */
const EXPECTED = {
  flat: [6774, 0.56636, 0.038026, -0.064451, 0.006193],
  flatStack: [4199, 0.56636, 0.044478, -0.042861, -0.018574],
  cap: [6016, 0.8, 0.082175, -0.31764, -0.002693],
  capStack: [4781, 0.8, 0.061626, -0.087059, 0.01603],
  wall: [4947, 0.35735, 0.026813, -0.006544, -0.000612],
  wallStack: [3648, 0.35735, 0.032087, 0.007604, 0.000022],
  slap: [4993, 0.8, 0.060594, -0.060543, 0.021677],
  smash: [7419, 0.8, 0.06958, -0.087059, 0.01603],
};
const stats = (page, name, options) =>
  page.evaluate(
    ([name, options]) => {
      const x = window.app.$sound.clack.synth(name, options);
      let energy = 0,
        peak = 0;
      for (const v of x) {
        energy += v * v;
        peak = Math.max(peak, Math.abs(v));
      }
      return [x.length, peak, Math.sqrt(energy / x.length), x[300], x[1500]];
    },
    [name, options]
  );

test("each sound matches the prototype's", async ({ page }) => {
  for (const [name, expected] of Object.entries(EXPECTED)) {
    const actual = await stats(page, name, { seed: 3 });
    expect(actual[0], name).toBe(expected[0]);
    actual
      .slice(1)
      .forEach((value, i) =>
        expect(value, `${name} [${i + 1}]`).toBeCloseTo(expected[i + 1], 5)
      );
  }
});

test("pitch and level change a sound", async ({ page }) => {
  const actual = await stats(page, "flat", {
    seed: 10,
    pitch: 1.05,
    level: -1.5,
  });
  [6774, 0.47653, 0.032863, 0.070575, 0.005894].forEach((value, i) =>
    expect(actual[i]).toBeCloseTo(value, 5)
  );
});

// The prototype's output with each material's numbers applied
const IN_MATERIAL = {
  wood: {
    flat: [6363, 0.56636, 0.042453, 0.12489, 0.029443],
    capStack: [4569, 0.8, 0.068847, 0.18912, 0.012104],
    wallStack: [3449, 0.35735, 0.041667, 0.1376, 0.00071039],
    smash: [7170, 0.8, 0.084773, 0.18912, 0.012104],
  },
  metal: {
    flat: [7596, 0.56636, 0.038047, 0.0341, 0.011343],
    capStack: [5204, 0.8, 0.055096, 0.050428, -0.0001379],
    wallStack: [4046, 0.35735, 0.029346, 0.054387, 0.00058706],
    smash: [7916, 0.8, 0.06525, 0.050428, -0.0001379],
  },
};

test("wood and metal alter the measured sound", async ({ page }) => {
  for (const [material, sounds] of Object.entries(IN_MATERIAL)) {
    for (const [name, expected] of Object.entries(sounds)) {
      const actual = await stats(page, name, { seed: 3, material });
      expect(actual[0], `${material} ${name}`).toBe(expected[0]);
      actual
        .slice(1)
        .forEach((value, i) =>
          expect(value, `${material} ${name} [${i + 1}]`).toBeCloseTo(
            expected[i + 1],
            5
          )
        );
    }
  }
  // The pitch option multiplies the material's own
  const actual = await stats(page, "flat", {
    seed: 10,
    pitch: 1.05,
    level: -1.5,
    material: "wood",
  });
  [6363, 0.47653, 0.032447, -0.01026, 0.0077256].forEach((value, i) =>
    expect(actual[i]).toBeCloseTo(value, 5)
  );
});

test("no two seeds sound the same", async ({ page }) => {
  const a = await stats(page, "flat", { seed: 1 });
  const b = await stats(page, "flat", { seed: 2 });
  expect(a[3]).not.toBeCloseTo(b[3], 4);
});

const GAME = `[Size "5"]

1. a1 e5 2. c3 Sc4 3. Cd3 a2 4. d3< b2 5. 2c3<11 b2+ 6. a3> c4- 7. b3> a2+ 8. Sd1 e1 9. d1> a4 10. 2c3>11`;

test("each move makes the sounds of its landings", async ({ page }) => {
  await loadPTN(page, GAME);
  const landings = await page.evaluate(() =>
    window.app.$store.state.game.ptn.allPlies.map(
      (ply) =>
        `${ply.text}: ` +
        window.app.$sound
          .landingsOf(ply)
          .map(({ name, player }) => `${name}(${player})`)
          .join(" ")
    )
  );
  expect(landings).toEqual([
    "a1: flat(2)", // White's first move places Black's flat
    "e5: flat(1)",
    "c3: flat(1)",
    "Sc4: wall(2)",
    "Cd3: cap(1)",
    "a2: flat(2)",
    "d3<: capStack(1)", // a capstone onto a flat
    "b2: flat(2)",
    "2c3<11: flat(1) cap(1)", // a flat, then the capstone, each onto an empty square
    "b2+: flatStack(2)",
    "a3>: capStack(1)",
    "c4-: wall(2)", // a wall moved onto an empty square
    "b3>*: smash(1)", // the capstone flattens the wall
    "a2+: flat(2)",
    "Sd1: wall(1)",
    "e1: flat(2)",
    "d1>: wallStack(1)", // a wall moved onto a flat
    "a4: flat(2)",
    "2c3>11: flat(2) cap(1)", // White spreads a stack with Black's flat under the capstone
  ]);
});

const requests = (page) =>
  page.evaluate(() =>
    window.app.$sound.player.history.map(
      ({ name, at, played }) => `${name} ${at.toFixed(2)} ${played}`
    )
  );

test.describe("the player", () => {
  test.beforeEach(async ({ page }) => {
    await page.evaluate(() => {
      const { player } = window.app.$sound;
      player.setContextFactory(null);
      player.history.length = 0;
    });
  });

  test("sounds are scheduled in order", async ({ page }) => {
    await page.evaluate(() =>
      window.app.$sound.player.play(
        [{ name: "flat" }, { name: "flatStack" }, { name: "cap" }],
        { delay: 0.3, gap: 0.09 }
      )
    );
    expect(await requests(page)).toEqual([
      "flat 0.30 true",
      "flatStack 0.39 true",
      "cap 0.48 true",
    ]);
    expect(
      await page.evaluate(() => window.app.$sound.player.context.state)
    ).toBe("running");
  });

  test("a burst is cut short", async ({ page }) => {
    await page.evaluate(() => {
      const { player } = window.app.$sound;
      for (let i = 0; i < 6; i++)
        player.play([{ name: "flat" }, { name: "flat" }], { delay: 1 });
    });
    const played = (await requests(page)).filter((r) => r.endsWith("true"));
    // The first four requests fill the limit of 8; the fifth and sixth are dropped
    expect(played).toHaveLength(8);
    expect(await requests(page)).toHaveLength(12);
  });

  test("a suspended context plays nothing later", async ({
    page,
    pageErrors,
  }) => {
    const started = await page.evaluate(async () => {
      const { player } = window.app.$sound;
      let sources = 0;
      // A context the browser won't start: resume() never resolves
      player.setContextFactory(() => ({
        state: "suspended",
        currentTime: 0,
        destination: {},
        resume: () => new Promise(() => {}),
        createBuffer: () => ({ copyToChannel() {} }),
        createGain: () => ({ gain: {}, connect() {} }),
        createBufferSource: () => ({ connect() {}, start: () => sources++ }),
      }));
      player.play([{ name: "flat" }]);
      await new Promise((resolve) => setTimeout(resolve, 400));
      return sources;
    });
    expect(started).toBe(0);
    expect(await requests(page)).toEqual(["flat 0.00 false"]);
    expect(pageErrors).toEqual([]);
  });

  test("a sound is made in its material", async ({ page }) => {
    const made = await page.evaluate(() => {
      const { player } = window.app.$sound;
      const lengths = [];
      // A running context that notes the length of each buffer it is asked for
      player.setContextFactory(() => ({
        state: "running",
        currentTime: 0,
        destination: {},
        resume: () => Promise.resolve(),
        createBuffer: (channels, length) => {
          lengths.push(length);
          return { copyToChannel() {} };
        },
        createGain: () => ({ gain: {}, connect() {} }),
        createBufferSource: () => ({ connect() {}, start() {} }),
      }));
      player.play([
        { name: "flat" },
        { name: "flat", material: "wood" },
        { name: "flat", material: "metal" },
      ]);
      return [lengths, player.history.map((request) => request.material)];
    });
    // A flat is 6774 samples long in stone, 6363 in wood and 7596 in metal
    expect(made).toEqual([
      [6774, 6363, 7596],
      ["stone", "wood", "metal"],
    ]);
  });
});
