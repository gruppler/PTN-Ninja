// @ts-check
const { test, expect } = require("./helpers");

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
