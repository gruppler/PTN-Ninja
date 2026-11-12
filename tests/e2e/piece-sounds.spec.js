// @ts-check
const { test, expect, loadPTN } = require("./helpers");
const { compressToEncodedURIComponent: compress } = require("lz-string");

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

const plyCount = (page) =>
  page.evaluate(() => window.app.$store.state.game.ptn.allPlies.length);

// Whether the player has made a context
const contextMade = (page) =>
  page.evaluate(() => window.app.$sound.player.context !== null);

/**
 * Make the player's contexts fakes that play nothing. The latest one's gain
 * node is window.__gain, and window.__resumes counts the calls to resume().
 * A suspended one stays suspended unless `resumeAfter` (ms) is given.
 */
const useFakeContext = (page, { state = "running", resumeAfter } = {}) =>
  page.evaluate(
    ([state, resumeAfter]) => {
      window.__resumes = 0;
      window.__starts = [];
      // The timer as it is now, should a test slow the page's timers down
      const wait = window.setTimeout.bind(window);
      window.app.$sound.player.setContextFactory(() => {
        const context = {
          state,
          currentTime: 0,
          destination: {},
          resume() {
            window.__resumes++;
            if (resumeAfter === null) return new Promise(() => {});
            return new Promise((resolve) =>
              wait(() => {
                context.state = "running";
                resolve();
              }, resumeAfter)
            );
          },
          close: () => Promise.resolve(),
          createBuffer: () => ({ copyToChannel() {} }),
          createGain: () => (window.__gain = { gain: {}, connect() {} }),
          createBufferSource: () => ({
            connect() {},
            start: (time) => window.__starts.push(time),
          }),
        };
        return context;
      });
    },
    [state, resumeAfter === undefined ? null : resumeAfter]
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

  test("a context that starts in time plays", async ({ page }) => {
    await useFakeContext(page, { state: "suspended", resumeAfter: 100 });
    await page.evaluate(() =>
      window.app.$sound.player.play([{ name: "flat" }], { delay: 0.3 })
    );
    await page.waitForTimeout(300);
    const starts = await page.evaluate(() => window.__starts);
    // On the context's clock, which stood still: the delay less the wait
    expect(starts).toHaveLength(1);
    expect(starts[0]).toBeGreaterThan(0.1);
    expect(starts[0]).toBeLessThan(0.21);
  });

  test("a context that starts too late plays nothing", async ({ page }) => {
    // It starts after 400 ms, while the page's timers run four times slow,
    // as in a hidden tab
    await useFakeContext(page, { state: "suspended", resumeAfter: 400 });
    const starts = await page.evaluate(async () => {
      const setTimeout = window.setTimeout;
      window.setTimeout = (fn, ms, ...args) =>
        setTimeout(fn, (ms || 0) * 4, ...args);
      try {
        window.app.$sound.player.play([{ name: "flat" }]);
        await new Promise((resolve) => setTimeout(resolve, 600));
      } finally {
        window.setTimeout = setTimeout;
      }
      return window.__starts;
    });
    expect(starts).toEqual([]);
  });

  test("landings waiting for the context count toward the limit", async ({
    page,
  }) => {
    await useFakeContext(page, { state: "suspended", resumeAfter: 50 });
    await page.evaluate(() => {
      const { player } = window.app.$sound;
      for (let i = 0; i < 6; i++)
        player.play([{ name: "flat" }, { name: "flat" }], { delay: 1 });
    });
    await page.waitForTimeout(300);
    expect(await page.evaluate(() => window.__starts.length)).toBe(8);
  });

  test("landings that waited in vain don't hold up later ones", async ({
    page,
  }) => {
    // A context that won't start until the person touches the page
    await useFakeContext(page, { state: "suspended" });
    await page.evaluate(() => {
      const { player } = window.app.$sound;
      for (let i = 0; i < 4; i++)
        player.play([{ name: "flat" }, { name: "flat" }]);
    });
    await page.waitForTimeout(300);
    await page.evaluate(() => {
      const { player } = window.app.$sound;
      player.context.state = "running";
      player.play([{ name: "flat" }]);
    });
    expect(await page.evaluate(() => window.__starts.length)).toBe(1);
  });

  // How many sounds of each kind are made and waiting to be played
  const ready = (page, material) =>
    page.evaluate((material) => {
      const { clack, player } = window.app.$sound;
      return Object.keys(clack.SOUNDS).map((name) =>
        player.ready(name, material)
      );
    }, material);

  test("sounds are made ahead of need", async ({ page }) => {
    expect(await ready(page, "wood")).toEqual([0, 0, 0, 0, 0, 0, 0, 0]);
    await page.evaluate(() => window.app.$sound.player.prime("wood"));
    expect(await contextMade(page)).toBe(false);
    await expect
      .poll(() => ready(page, "wood"))
      .toEqual([2, 2, 2, 2, 2, 2, 2, 2]);
  });

  test("a move takes a sound made ahead", async ({ page }) => {
    // A new context forgets the sounds made ahead, so it comes first
    await useFakeContext(page);
    await page.evaluate(() => window.app.$sound.player.prime());
    await expect.poll(() => ready(page)).toEqual([2, 2, 2, 2, 2, 2, 2, 2]);
    const left = await page.evaluate(() => {
      const { player } = window.app.$sound;
      player.play([{ name: "flat" }]);
      return player.ready("flat");
    });
    expect(left).toBe(1);
    expect(await page.evaluate(() => window.__starts)).toEqual([0]);
    expect(await requests(page)).toEqual(["flat 0.00 true"]);
    await expect
      .poll(() => page.evaluate(() => window.app.$sound.player.ready("flat")))
      .toBe(2);
  });

  test("a sound not made ahead is made at once", async ({ page }) => {
    await useFakeContext(page);
    expect(
      await page.evaluate(() => {
        const { player } = window.app.$sound;
        player.play([{ name: "flat", material: "metal" }]);
        return [player.ready("cap", "metal"), window.__starts];
      })
    ).toEqual([0, [0]]);
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

const setUI = (page, key, value) =>
  page.evaluate(
    ([key, value]) => window.app.$store.dispatch("ui/SET_UI", [key, value]),
    [key, value]
  );

const dispatch = (page, action, payload) =>
  page.evaluate(
    ([action, payload]) => window.app.$store.dispatch(action, payload),
    [action, payload]
  );

// What the player was asked to play while `action` ran
const heard = async (page, action) => {
  await page.evaluate(() => (window.app.$sound.player.history.length = 0));
  await action();
  await page.waitForTimeout(300);
  return requests(page);
};

// A touch of the page, as the browser reports it to the document
const touch = (page) =>
  page.evaluate(() =>
    document.body.dispatchEvent(
      new PointerEvent("pointerdown", { bubbles: true })
    )
  );

test.describe("playing on moves", () => {
  test.beforeEach(async ({ page }) => {
    await page.evaluate(() => window.app.$sound.player.setContextFactory(null));
    // loadPTN waits for animations to be on, and a test may have turned them off
    await setUI(page, "animateBoard", true);
    await loadPTN(page, '[Size "5"]\n\n1. a1 e5 2. c3 Sc4 3. Cd3 a2 4. d3< b2');
    await setUI(page, "sound", "moves");
    await setUI(page, "soundVolume", 80);
  });

  test("a move entered as text sounds as its transition ends", async ({
    page,
  }) => {
    expect(
      await heard(page, () => dispatch(page, "game/INSERT_PLY", "e1"))
    ).toEqual(["flat 0.30 true"]);
    // No textures yet: every piece is stone
    expect(
      await page.evaluate(() =>
        window.app.$sound.player.history.map((request) => request.material)
      )
    ).toEqual(["stone"]);
  });

  test("a stack being spread sounds each drop", async ({ page }) => {
    expect(
      await heard(page, () => dispatch(page, "game/INSERT_PLY", "2c3<11"))
    ).toEqual(["flat 0.30 true", "cap 0.39 true"]);
  });

  test("without board animation a move sounds at once", async ({ page }) => {
    await setUI(page, "animateBoard", false);
    expect(
      await heard(page, () => dispatch(page, "game/INSERT_PLY", "e1"))
    ).toEqual(["flat 0.00 true"]);
  });

  test("a move made on the board sounds", async ({ page }) => {
    // A placement by tapping a square
    expect(
      await heard(page, () =>
        dispatch(page, "game/SELECT_SQUARE", { square: "e1" })
      )
    ).toEqual(["flat 0.30 true"]);
    // A piece picked up and set down on the next square (Black's wall, c4
    // to b4) lands when it gets there
    const taps = async () => {
      await dispatch(page, "game/SELECT_SQUARE", { square: "c4" });
      await dispatch(page, "game/SELECT_SQUARE", { square: "b4" });
    };
    expect(await heard(page, taps)).toEqual(["wall 0.30 true"]);
  });

  const tap = (page, square) =>
    dispatch(page, "game/SELECT_SQUARE", { square });

  test("a stack spread by taps sounds each piece as it is set down", async ({
    page,
  }) => {
    // White's c3 holds a flat under the capstone; b3 and a3 are empty
    expect(await heard(page, () => tap(page, "c3"))).toEqual([]);
    expect(await heard(page, () => tap(page, "b3"))).toEqual([
      "flat 0.30 true",
    ]);
    expect(await heard(page, () => tap(page, "a3"))).toEqual(["cap 0.30 true"]);
    expect(
      await page.evaluate(() => window.app.$store.state.game.position.ply.text)
    ).toBe("2c3<11");
  });

  test("a piece set down on one just dropped lands on a stack", async ({
    page,
  }) => {
    // Both pieces onto the empty d3: the flat, then the capstone on it
    await tap(page, "c3");
    expect(await heard(page, () => tap(page, "d3"))).toEqual([
      "flat 0.30 true",
    ]);
    expect(await heard(page, () => tap(page, "d3"))).toEqual([
      "capStack 0.30 true",
    ]);
    expect(
      await page.evaluate(() => window.app.$store.state.game.position.ply.text)
    ).toBe("2c3>");
  });

  test("pieces set down on other pieces land on stacks", async ({ page }) => {
    // b3 holds a black flat and a3 a stack of two
    await loadPTN(
      page,
      '[Size "5"]\n\n1. a1 e5 2. c3 Sc4 3. Cd3 a2 4. d3< b2 5. a3 b2+ 6. a4 a2+'
    );
    await tap(page, "c3");
    expect(await heard(page, () => tap(page, "b3"))).toEqual([
      "flatStack 0.30 true",
    ]);
    expect(await heard(page, () => tap(page, "a3"))).toEqual([
      "capStack 0.30 true",
    ]);
  });

  test("picking up, changing how many, and putting back are silent", async ({
    page,
  }) => {
    const quiet = async () => {
      await tap(page, "c3"); // both pieces
      await tap(page, "c3"); // only the capstone
      await dispatch(page, "game/CANCEL_MOVE");
      await tap(page, "c3");
      await tap(page, "b3"); // one set down...
    };
    expect(
      (await heard(page, quiet)).filter(
        (request) => !/^flat 0.30/.test(request)
      )
    ).toEqual([]);
    // ...and taken back
    expect(await heard(page, () => dispatch(page, "game/CANCEL_MOVE"))).toEqual(
      []
    );
  });

  test("without board animation a piece set down sounds at once", async ({
    page,
  }) => {
    await setUI(page, "animateBoard", false);
    await tap(page, "c3");
    expect(await heard(page, () => tap(page, "b3"))).toEqual([
      "flat 0.00 true",
    ]);
    expect(await heard(page, () => tap(page, "a3"))).toEqual(["cap 0.00 true"]);
  });

  test("Live Games is silent while a move is made by taps", async ({
    page,
  }) => {
    await setUI(page, "sound", "live");
    const taps = async () => {
      await tap(page, "c3");
      await tap(page, "b3");
      await tap(page, "a3");
    };
    expect(await heard(page, taps)).toEqual([]);
  });

  test("a move the game already has sounds", async ({ page }) => {
    await dispatch(page, "game/INSERT_PLY", "e1");
    const back = () => dispatch(page, "game/PREV", { half: false, times: 1 });
    // Entered as text
    await back();
    expect(
      await heard(page, () => dispatch(page, "game/INSERT_PLY", "e1"))
    ).toEqual(["flat 0.30 true"]);
    // Made on the board
    await back();
    expect(
      await heard(page, () =>
        dispatch(page, "game/SELECT_SQUARE", { square: "e1" })
      )
    ).toEqual(["flat 0.30 true"]);
  });

  test("a flat tapped into a wall sounds the wall", async ({ page }) => {
    const tap = () => dispatch(page, "game/SELECT_SQUARE", { square: "e1" });
    await tap();
    expect(await heard(page, tap)).toEqual(["wall 0.30 true"]);
    // And again when the wall is a move the game already has
    await dispatch(page, "game/PREV", { half: false, times: 1 });
    await dispatch(page, "game/INSERT_PLY", "e1");
    expect(await heard(page, tap)).toEqual(["wall 0.30 true"]);
    // White's capstone is on d3, so the next tap makes it a flat again
    expect(await heard(page, tap)).toEqual(["flat 0.30 true"]);
  });

  test("navigation, undo and loading are silent", async ({ page }) => {
    await dispatch(page, "game/INSERT_PLY", "e1");
    const quiet = async () => {
      await dispatch(page, "game/PREV", { half: false, times: 1 });
      await dispatch(page, "game/NEXT", { half: false, times: 1 });
      await dispatch(page, "game/FIRST");
      await dispatch(page, "game/LAST");
      await dispatch(page, "game/UNDO");
      await dispatch(page, "game/REDO");
      await dispatch(page, "game/INSERT_PLIES", { plies: "e2 d1" });
    };
    expect(await heard(page, quiet)).toEqual([]);
    expect(await heard(page, () => loadPTN(page, GAME))).toEqual([]);
  });

  test("an illegal move is silent", async ({ page, pageErrors }) => {
    // a1 is taken. The mutation is committed, but no ply is added
    expect(
      await heard(page, () => dispatch(page, "game/APPEND_PLY", "a1"))
    ).toEqual([]);
    // Inserted, it throws before the mutation is seen
    expect(
      await heard(page, () =>
        dispatch(page, "game/INSERT_PLY", "a1").catch(() => {})
      )
    ).toEqual([]);
    pageErrors.length = 0;
  });

  test("the same move sounds again after an undo", async ({ page }) => {
    await dispatch(page, "game/INSERT_PLY", "e1");
    await dispatch(page, "game/UNDO");
    expect(
      await heard(page, () => dispatch(page, "game/INSERT_PLY", "e1"))
    ).toEqual(["flat 0.30 true"]);
  });

  test("Live Games sounds only moves arriving in a live game", async ({
    page,
  }) => {
    await setUI(page, "sound", "live");
    expect(
      await heard(page, () => dispatch(page, "game/INSERT_PLY", "e1"))
    ).toEqual([]);
    // A live game's move arrives while the board is elsewhere (the game now has
    // nine plies, so the next one is a new move)
    const live = { playtakID: "123456", syncedMainlineCount: 9 };
    await page.evaluate(
      (live) => window.app.$store.commit("game/SET_PLAYTAK_LIVE_CONFIG", live),
      live
    );
    await dispatch(page, "game/FIRST");
    expect(
      await heard(page, () =>
        dispatch(page, "game/APPEND_PLY", { ply: "e2", playtakLive: live })
      )
    ).toEqual(["flat 0.30 true"]);
  });

  // The live game has the eight plies loaded, and the spectator plays on
  const playPastLive = async (page, ply) => {
    await setUI(page, "sound", "live");
    const live = { playtakID: "123456", syncedMainlineCount: 8 };
    await page.evaluate(
      (live) => window.app.$store.commit("game/SET_PLAYTAK_LIVE_CONFIG", live),
      live
    );
    await dispatch(page, "game/INSERT_PLY", ply);
    return live;
  };

  test("a live move sounds past a spectator's different move", async ({
    page,
  }) => {
    const live = await playPastLive(page, "e1");
    // The live move becomes the main line, the spectator's a branch
    expect(
      await heard(page, () =>
        dispatch(page, "game/APPEND_PLY", { ply: "Se2", playtakLive: live })
      )
    ).toEqual(["wall 0.30 true"]);
  });

  test("a live move sounds when the spectator made it first", async ({
    page,
  }) => {
    const live = await playPastLive(page, "Se2");
    const count = await plyCount(page);
    expect(
      await heard(page, () =>
        dispatch(page, "game/APPEND_PLY", { ply: "Se2", playtakLive: live })
      )
    ).toEqual(["wall 0.30 true"]);
    expect(await plyCount(page)).toBe(count);
    // The same move arriving twice sounds once
    expect(
      await heard(page, () =>
        dispatch(page, "game/APPEND_PLY", { ply: "Se2", playtakLive: live })
      )
    ).toEqual([]);
  });

  test("Live Games is silent for a move appended outside a live game", async ({
    page,
  }) => {
    await setUI(page, "sound", "live");
    expect(
      await heard(page, () => dispatch(page, "game/APPEND_PLY", "e1"))
    ).toEqual([]);
  });

  test("off never starts audio", async ({ page }) => {
    await setUI(page, "sound", "off");
    expect(
      await heard(page, () => dispatch(page, "game/INSERT_PLY", "e1"))
    ).toEqual([]);
    await touch(page);
    await setUI(page, "sound", "moves");
    await setUI(page, "soundVolume", 0);
    expect(
      await heard(page, () => dispatch(page, "game/INSERT_PLY", "e2"))
    ).toEqual([]);
    await touch(page);
    expect(await contextMade(page)).toBe(false);
  });

  test("the first touch starts audio", async ({ page }) => {
    // A context the browser starts only while a gesture is being handled
    await useFakeContext(page, { state: "suspended" });
    await touch(page);
    expect(await page.evaluate(() => window.__resumes)).toBe(1);
  });

  test("the volume sets the gain", async ({ page }) => {
    await setUI(page, "soundVolume", 50);
    await page.evaluate(() => {
      // The fake context of "a suspended context plays nothing later", but
      // running, and keeping its gain node where the test can read it
      window.__gain = { gain: {}, connect() {} };
      window.app.$sound.player.setContextFactory(() => ({
        state: "running",
        currentTime: 0,
        destination: {},
        resume: () => Promise.resolve(),
        createBuffer: () => ({ copyToChannel() {} }),
        createGain: () => window.__gain,
        createBufferSource: () => ({ connect() {}, start() {} }),
      }));
    });
    await heard(page, () => dispatch(page, "game/INSERT_PLY", "e1"));
    expect(await page.evaluate(() => window.__gain.gain.value)).toBe(0.5);
  });

  test("a volume from a URL never breaks a move", async ({ page }) => {
    // An embed's URL values arrive as strings
    for (const [volume, gain] of [
      ["loud", null],
      ["0", null],
      ["1000", 1],
    ]) {
      // A real context for the silent ones: a real gain refuses NaN
      if (gain === null) {
        await page.evaluate(() =>
          window.app.$sound.player.setContextFactory(null)
        );
      } else {
        await useFakeContext(page);
      }
      await setUI(page, "soundVolume", volume);
      const before = await plyCount(page);
      const sounds = await heard(page, () =>
        dispatch(page, "game/INSERT_PLY", "e1")
      );
      expect(await plyCount(page), volume).toBe(before + 1);
      await dispatch(page, "game/UNDO");
      if (gain === null) {
        expect(sounds, volume).toEqual([]);
        expect(await contextMade(page), volume).toBe(false);
      } else {
        expect(sounds, volume).toEqual(["flat 0.30 true"]);
        expect(await page.evaluate(() => window.__gain.gain.value)).toBe(gain);
      }
    }
  });

  test("a failure in the sound code doesn't break a move", async ({ page }) => {
    await page.evaluate(() => {
      window.__errors = [];
      window.__consoleError = console.error;
      console.error = (...args) => window.__errors.push(String(args[0]));
      window.app.$sound.player.setContextFactory(() => ({
        state: "running",
        currentTime: 0,
        destination: {},
        resume: () => Promise.resolve(),
        createBuffer: () => {
          throw new Error("no buffers today");
        },
        createGain: () => ({ gain: {}, connect() {} }),
        createBufferSource: () => ({ connect() {}, start() {} }),
      }));
    });
    try {
      const before = await plyCount(page);
      await dispatch(page, "game/INSERT_PLY", "e1");
      expect(await plyCount(page)).toBe(before + 1);
      expect(await page.evaluate(() => window.__errors)).toEqual([
        "Error: no buffers today",
      ]);
    } finally {
      await page.evaluate(() => (console.error = window.__consoleError));
    }
  });

  // Open an embed with the given URL parameters, and run `use` on its frame
  const inEmbed = async (page, params, use) => {
    const host = await page.context().newPage();
    try {
      await host.route("**/embed-host", (route) =>
        route.fulfill({
          contentType: "text/html",
          body:
            '<iframe id="embed" style="width:900px;height:700px" ' +
            `src="/${compress('[Size "5"]\n\n1. a1 e5')}${params}"></iframe>`,
        })
      );
      await host.goto("/embed-host");
      const body = host.frameLocator("#embed").locator("body");
      await expect
        .poll(() =>
          body.evaluate(() => Boolean(window.app && window.app.$store))
        )
        .toBe(true);
      await use(body);
    } finally {
      await host.close();
    }
  };

  test("an embed is silent unless asked", async ({ page }) => {
    for (const [params, expected] of [
      ["", "off"],
      ["&sound=moves", "moves"],
    ]) {
      await inEmbed(page, params, (body) =>
        expect
          .poll(() => body.evaluate(() => window.app.$store.state.ui.sound))
          .toBe(expected)
      );
    }
  });

  test("a silent embed makes no sounds ahead", async ({ page }) => {
    const ready = (body) =>
      body.evaluate(() => window.app.$sound.player.ready("flat"));
    await inEmbed(page, "", async (body) => {
      await page.waitForTimeout(1000);
      expect(await ready(body)).toBe(0);
    });
    // Asked for sound, it makes them as soon as it is turned on
    await inEmbed(page, "&sound=moves", (body) =>
      expect.poll(() => ready(body)).toBe(2)
    );
  });
});
