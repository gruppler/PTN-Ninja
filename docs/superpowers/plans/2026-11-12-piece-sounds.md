# Piece Sounds Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Pieces make a believable synthesized "clack" when a move is made, in every board view, with a setting for when (off, live games, every move) and how loud. Each sound comes in three materials (stone, wood, metal), ready for the 3D view's textures; until those exist every piece makes the measured stone sound.

**Architecture:** Four small modules under `src/sound/`. `clack.js` turns a sound's name into samples, with no browser audio in it. `landings.js` turns a ply into the sounds it makes and whose piece makes each, from the ply's own data. `player.js` owns the `AudioContext` and schedules buffers on its clock. A boot file watches Vuex mutations, decides whether a move was made, and asks the player to play it. Nothing touches a Game object or the board components.

**Tech Stack:** Vue 2.6, Quasar 1, Vuex 3, Web Audio, Playwright e2e (`tests/e2e`). There is no unit-test runner; pure functions are tested in the page through `window.app.$sound`.

**Spec:** `docs/superpowers/specs/2026-11-12-photoreal-3d-board-design.md`, section 7 and step 5 of "Order of work". The numbers come from the sound prototype, `public/prototype-sound/clack.js` (also on branch `prototype/photoreal-3d`). This plan is independent of the 3D scene; plan 3 (play in 3D) will later pass its own landing times to the player, and plan 4 (textures) will say which material each player's pieces are.

## Global Constraints

- Every sound is synthesized. No audio files are added to the app.
- The prototype's `MEASURED` tables, `PRESETS` and `MATERIALS` are the specification. Carry them over as they are; a ported sound must match the prototype's output sample for sample (Task 1's test).
- Navigation is always silent: stepping, scrubbing, playback, jumping, undo, redo, loading or switching games.
- Until the user has touched the page the browser refuses audio; the app must stay silent without an error, and must not play a backlog when audio does start.
- The sound follows the texture: a piece textured as stone, wood or metal in the 3D view lands with that material's sound; in 2D and 2.5D, and untextured, it is the measured (stone) sound. Neither the 3D view nor its textures exist yet, so in this plan every move plays stone, through one function that plan 4 fills in (Task 4).
- There are no tuning controls: a mode and a volume.
- Read state from the Vuex store and change it through Vuex actions. Never touch a Game object.
- New i18n strings go in `src/i18n/en-us/index.js` in alphabetical order within their category.
- Run `npx prettier --write` on every file you modify.
- Commit through the project's `commit-and-push` skill. No `Co-Authored-By` trailer. Never edit `src/changelog.json` or the `package.json` version.
- Tests: `cd tests && npx playwright test e2e/<spec> --trace off`. The dev server on `localhost:8081` is reused if it is running.

## Review Focus

- **A move that fails.** `game/APPEND_PLY` and `game/INSERT_PLY` are committed even when the ply is illegal and nothing is added. No sound. Task 4, test "an illegal move is silent".
- **A burst of moves.** A reconnect can deliver several live plies at once, and they must not rattle like a machine gun. A request made while 8 or more landings are still to come is dropped. Task 3, test "a burst is cut short".
- **Audio that can't start.** With the context suspended and no user gesture, nothing plays, nothing throws, and nothing is queued to play later. Task 3, test "a suspended context plays nothing later".
- **Sound off.** With the mode Off or the volume 0, no `AudioContext` is ever created. Task 4, test "off never starts audio".
- **Embeds.** A game embedded in someone else's page is silent unless its URL asks for sound. Task 4, test "an embed is silent unless asked".

---

### Task 1: The synthesizer

**Files:**

- Create: `src/sound/clack.js`
- Create: `src/sound/index.js`
- Create: `changelog/unreleased/piece-sounds.json`
- Modify: `src/boot/globalComponents.js:30` (expose the module to tests, beside `$settingsRegistry`)
- Test: `tests/e2e/piece-sounds.spec.js`

**Interfaces:**

- Consumes: `public/prototype-sound/clack.js`, the source being ported.
- Produces, from `src/sound/clack.js`:
  - `SAMPLE_RATE = 44100`
  - `SOUNDS: { [name]: sound }` for the names `flat`, `flatStack`, `cap`, `capStack`, `wall`, `wallStack`, `slap`, `smash`
  - `MATERIALS: { stone, wood, metal }`, each `{ pitch, tilt, length, contact }`
  - `synth(name: string, { seed = 1, pitch = 1, level = 0, material = "stone" } = {}) => Float32Array`, where `pitch` multiplies every frequency (on top of the material's own), `level` is in dB and `material` is a key of `MATERIALS`
- Produces, from `src/sound/index.js`: `export * as clack from "./clack"` for now; Tasks 2 and 3 add to it. `Vue.prototype.$sound` is this module.

- [ ] **Step 1: Write the changelog entry and get it approved**

Create `changelog/unreleased/piece-sounds.json`:

```json
{
  "bump": "minor",
  "changes": [
    {
      "type": "added",
      "description": "Pieces make a sound when they land. Choose every move, live games only or off, and the volume, under Board in Settings."
    }
  ]
}
```

Run `yarn changelog:check`. Show the entry to Craig and wait for his approval before the first commit (the `commit-and-push` skill's review gate). It covers every commit in this plan.

- [ ] **Step 2: Write the failing test**

`tests/e2e/piece-sounds.spec.js`, using `test`, `expect` and `loadPTN` from `./helpers`. The expected numbers are the prototype's output for the same seed: `[samples, peak, rms, sample 300, sample 1500]`.

```js
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
```

- [ ] **Step 3: Run it to see it fail**

Run: `cd tests && npx playwright test e2e/piece-sounds.spec.js --trace off`
Expected: FAIL, `window.app.$sound` is undefined.

- [ ] **Step 4: Port the synthesizer to `src/sound/clack.js`**

Copy from `public/prototype-sound/clack.js`, as an ES module, **without changing the order of any `rand()` call** (the test compares samples, and every call advances the generator):

- `rng`, `MEASURED`, `shifted`, `PRESETS` (exported as `SOUNDS`), `MATERIALS` (without `density`, which is 5 for all three), `synth`, `finish`.
- `synth` takes a sound's name. Its options are `seed`, `pitch`, `level` and `material`. The prototype's `tilt`, `length` and `contact` come from `MATERIALS[material]`, and its `pitch` is the option times the material's, as the prototype's page combines them (`public/prototype-sound/index.html:272-280`). The rest are fixed at their defaults: `rattle: 0`, `density: 5`, `fill: 3`; remove the terms that then add 0. A sound made of parts (`smash`) passes its material to each part.
- Leave out `BANDS`, `fromHumps`, `analyze`, `fit`, `fft`, the `tick` noise and the `tail` (every preset has `tick: -99` and `tail: null`, so neither branch runs or draws a random number), and with them the `tick`, `tail` and `body` fields.
- Keep the comments that say why: several resonances per band, starting from rest, the swell over the contact time.

- [ ] **Step 5: Expose it**

`src/sound/index.js` exports `clack`. In `src/boot/globalComponents.js`, beside the line that sets `Vue.prototype.$settingsRegistry`, set `Vue.prototype.$sound` to the `src/sound` module.

- [ ] **Step 6: Run the test**

Run: `cd tests && npx playwright test e2e/piece-sounds.spec.js --trace off`
Expected: PASS.

- [ ] **Step 7: Commit**

Format, then commit with the `commit-and-push` skill: "Synthesize the sounds of pieces landing".

---

### Task 2: Which sounds a move makes

**Files:**

- Create: `src/sound/landings.js`
- Modify: `src/sound/index.js`
- Test: `tests/e2e/piece-sounds.spec.js`

**Interfaces:**

- Consumes: a ply as the store exposes it (`state.game.ptn.allPlies[i]`, the frozen output of `src/Game/PTN/Ply.js`): `direction`, `specialPiece` (`"C"`, `"S"` or absent), `squares` (a placement's square; a movement's origin followed by each square dropped on), `distribution` (a string of digits, one per drop), `wallSmash`, and `tpsBefore`. The `TPS` class in `src/Game/PTN/TPS.js`: `new TPS(tps).grid[row][column]`, row 0 being rank 1, each cell `"x"` or a stack string such as `"121C"` whose last character is `S`, `C` or a digit.
- Produces: `landingsOf(ply) => { name: string, player: 1 | 2 }[]`, the sounds the ply makes, in the order its pieces land, each with the player whose piece makes it (a piece's owner, which decides its texture); exported from `src/sound/index.js`. A ply also has `color`, the owner of a placed piece (in the first two plies each player places the other's flat, so it differs from `ply.player`). In a stack string each digit is the owner of a piece, bottom first.

- [ ] **Step 1: Write the failing test**

Add to `tests/e2e/piece-sounds.spec.js`. Every ply of this game is legal and has been checked in the app:

```js
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
```

- [ ] **Step 2: Run it to see it fail**

Run: `cd tests && npx playwright test e2e/piece-sounds.spec.js -g "landings" --trace off`
Expected: FAIL, `landingsOf` is not a function.

- [ ] **Step 3: Implement `landingsOf(ply)` in `src/sound/landings.js`**

The rules:

- A piece is `cap` if it is a capstone, `wall` if it is standing, else `flat`.
- **A placement** makes one sound: its piece, from `specialPiece`. It always lands on an empty square.
- **A movement** makes one sound per drop, in order. Every drop but the last is a `flat`. The last is the piece that was on top of the origin stack, read from the last character of the origin's cell in `tpsBefore`.
- A drop onto a square that holds a piece in `tpsBefore` takes the `Stack` form of its name.
- If `wallSmash` is set, the last drop is `smash` and nothing else.
- **The player** of a placement is `ply.color`. The player of a drop is the owner of the piece on top of what is dropped there: split the carried pieces (the top `distribution` total of the origin's stack) by `distribution`, bottom first, and take the last of each group.

- [ ] **Step 4: Run the test**

Run: `cd tests && npx playwright test e2e/piece-sounds.spec.js --trace off`
Expected: PASS.

- [ ] **Step 5: Commit**

Format, then commit with the `commit-and-push` skill: "Work out which sounds a move makes".

---

### Task 3: The player

**Files:**

- Create: `src/sound/player.js`
- Modify: `src/sound/index.js`
- Test: `tests/e2e/piece-sounds.spec.js`

**Interfaces:**

- Consumes: `synth` and `SAMPLE_RATE` from Task 1.
- Produces, from `src/sound/player.js`, exported as `player` from `src/sound/index.js`:

  - `play(sounds: { name: string, material?: string }[], { delay = 0, gap = 0, volume = 1 } = {}) => void`: `sounds[i]` sounds `delay + i * gap` seconds from now, in its material (`"stone"` when absent), at `volume` (0 to 1, a linear gain).
  - `context: AudioContext | null`: null until the first `play`.
  - `history: { name: string, material: string, at: number, played: boolean }[]`: the last 50 requests, newest last. `at` is the offset in seconds from the call that made it; `played` is false when it was dropped. This is how tests see what was asked for, since they can't hear.
  - `setContextFactory(factory | null)`: tests swap in a fake context; null restores `() => new AudioContext({ sampleRate: SAMPLE_RATE })`. Either way the current context is closed and forgotten (`context` is null again) and nothing counts as pending.

- [ ] **Step 1: Write the failing tests**

Add to `tests/e2e/piece-sounds.spec.js`. Each test first resets the player with `setContextFactory(null)` and empties `history` (`history.length = 0`).

```js
const requests = (page) =>
  page.evaluate(() =>
    window.app.$sound.player.history.map(
      ({ name, at, played }) => `${name} ${at.toFixed(2)} ${played}`
    )
  );

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
```

- [ ] **Step 2: Run them to see them fail**

Run: `cd tests && npx playwright test e2e/piece-sounds.spec.js -g "scheduled|burst|suspended|its material" --trace off`
Expected: FAIL, `player` is undefined.

- [ ] **Step 3: Implement `src/sound/player.js`**

- The context is created on the first `play`, at `SAMPLE_RATE`, with one master `GainNode` between every source and the destination. Each `play` sets its `gain.value` to `volume`.
- Each sound is synthesized when requested, in its material, into a buffer made with `context.createBuffer(1, samples.length, SAMPLE_RATE)`, with a seed from a counter that never repeats, `pitch` uniform in 0.94 to 1.06 and `level` uniform in −1.8 to +1.8 dB, so no two are alike.
- Sounds are started on the context's own clock (`source.start(context.currentTime + offset)`), never with `setTimeout`, so a background tab's throttled timers can't smear them.
- **The burst limit:** count the landings whose start time is still in the future. If 8 or more are pending when `play` is called, record the request's sounds in `history` with `played: false` and do nothing else.
- **A suspended context:** if `context.state` isn't `"running"`, call `resume()`. If it resolves within 250 ms, schedule the sounds with what remains of their delay; if not, drop them (`played: false`). The first move a person makes is itself the gesture that lets audio start, so that move is heard; a move that arrives before any gesture is not, and is never played late.
- A failure to create the context (no Web Audio) is caught once; the player then records requests and plays nothing.

- [ ] **Step 4: Run the tests**

Run: `cd tests && npx playwright test e2e/piece-sounds.spec.js --trace off`
Expected: PASS.

- [ ] **Step 5: Commit**

Format, then commit with the `commit-and-push` skill: "Play piece sounds on the audio clock".

---

### Task 4: The setting, and playing on moves

**Files:**

- Create: `src/boot/sound.js`
- Modify: `quasar.conf.js:16` (add `"sound"` to `boot`, last)
- Modify: `src/store/ui/state.js` (two defaults; embeds default to off)
- Modify: `src/settings/registry.js` (a section, two entries)
- Modify: `src/i18n/en-us/index.js`
- Test: `tests/e2e/piece-sounds.spec.js`

**Interfaces:**

- Consumes: `landingsOf` (Task 2); `player.play` and `player.history` (Task 3); the store's mutations, through `store.subscribe` (as `src/bots/tinue-solver.js:33` names the mutations a move is played through).
- Produces:

  - `state.ui.sound: "off" | "live" | "moves"`, default `"moves"`; `state.ui.soundVolume: number`, 0 to 100, default 80.
  - `PIECE_TRANSITION = 0.3` (seconds) and `DROP_GAP = 0.09`, exported from `src/boot/sound.js`. Plan 3 replaces these with the 3D arcs' own landing times when the 3D view is showing.
  - `materialOf(state, player: 1 | 2) => "stone" | "wood" | "metal"`, exported from `src/boot/sound.js`: the material of that player's pieces as the board shows them now. It returns `"stone"` in this plan. Plan 4 gives it its body: in the 3D view, the player's piece texture when that is stone, wood or metal; otherwise `"stone"`.

- [ ] **Step 1: Write the failing tests**

Add to `tests/e2e/piece-sounds.spec.js`. `heard(page, action)` empties `history`, runs the action, waits 300 ms (a move made by a tap is committed after an awaited check) and returns `requests(page)`. `setUI` is as in `tests/e2e/highlight-pieces.spec.js`. Each test resets the player, loads `[Size "5"]\n\n1. a1 e5 2. c3 Sc4 3. Cd3 a2 4. d3< b2` with `loadPTN` (the board is then at the end, White to move) and sets `sound` to `"moves"`, `soundVolume` to 80 and `animateBoard` to `true` unless it says otherwise.

```js
const dispatch = (page, action, payload) =>
  page.evaluate(
    ([action, payload]) => window.app.$store.dispatch(action, payload),
    [action, payload]
  );

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
  // Pieces carried by taps are already in place when the move completes
  // (Black's wall, c4 to b4): only the last landing sounds, at once
  const taps = async () => {
    await dispatch(page, "game/SELECT_SQUARE", { square: "c4" });
    await dispatch(page, "game/SELECT_SQUARE", { square: "b4" });
  };
  expect(await heard(page, taps)).toEqual(["wall 0.00 true"]);
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
  // A live game's move arrives while the board is elsewhere
  const live = { playtakID: "123456", syncedMainlineCount: 8 };
  await page.evaluate(
    (live) => window.app.$store.commit("game/SET_PLAYTAK_LIVE_CONFIG", live),
    live
  );
  await dispatch(page, "game/FIRST");
  expect(
    await heard(page, () =>
      dispatch(page, "game/APPEND_PLY", { ply: "e1", playtakLive: live })
    )
  ).toEqual(["flat 0.30 true"]);
});

test("off never starts audio", async ({ page }) => {
  await page.evaluate(() => window.app.$sound.player.setContextFactory(null));
  await setUI(page, "sound", "off");
  expect(
    await heard(page, () => dispatch(page, "game/INSERT_PLY", "e1"))
  ).toEqual([]);
  await setUI(page, "sound", "moves");
  await setUI(page, "soundVolume", 0);
  expect(
    await heard(page, () => dispatch(page, "game/INSERT_PLY", "e2"))
  ).toEqual([]);
  expect(await page.evaluate(() => window.app.$sound.player.context)).toBe(
    null
  );
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

test("an embed is silent unless asked", async ({ page }) => {
  for (const [params, expected] of [
    ["", "off"],
    ["&sound=moves", "moves"],
  ]) {
    // …open an embed of '[Size "5"]\n\n1. a1 e5' with `params`, as "embed
    // hides disabled options and their children" does in
    // tests/e2e/settings.spec.js:752…
    await expect
      .poll(() =>
        frame.locator("body").evaluate(() => window.app.$store.state.ui.sound)
      )
      .toBe(expected);
  }
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `cd tests && npx playwright test e2e/piece-sounds.spec.js --trace off`
Expected: the new tests FAIL (nothing is requested; `state.ui.sound` is undefined).

- [ ] **Step 3: Add the settings**

`src/store/ui/state.js`: `sound: "moves",` and `soundVolume: 80,` among the defaults, in alphabetical place. After the block that loads from LocalStorage, an embed that hasn't been told otherwise is silent: `if (state.embed) state.sound = "off";` (`Embed.vue`'s `created` then applies the URL's settings, so `&sound=moves` turns it on).

`src/settings/registry.js`:

- A section in the `board` category, after `view`: `{ id: "sound", label: "settings.sections.board.sound" }`.
- After the `perspective` entry:

```js
  // Board / Sound
  ui("sound", {
    label: "Piece Sounds",
    keywords: ["clack", "audio", "mute"],
    control: "select",
    options: [
      { label: "Every Move", value: "moves" },
      { label: "Live Games", value: "live" },
      { label: "Off", value: "off" },
    ],
    category: "board",
    section: "sound",
    sync: "always",
  }),
  ui("soundVolume", {
    label: "Volume",
    control: "slider",
    min: 0,
    max: 100,
    step: 5,
    category: "board",
    section: "sound",
    dependsOn: "ui:sound",
    disabledWhen: (rootState) => rootState.ui.sound === "off",
    sync: "always",
  }),
```

`src/i18n/en-us/index.js`: `"Every Move"`, `"Live Games"`, `Off`, `"Piece Sounds"`, `Volume`, and `settings.sections.board.sound: "Sound"`.

The board menu (`src/components/controls/BoardToggles.vue`) lists its sections by name and is not given this one: the setting lives in Settings only.

- [ ] **Step 4: Write `src/boot/sound.js`**

A Quasar boot file that receives `{ store }` and calls `store.subscribe((mutation, state) => …)`.

**Knowing a ply was added.** After every mutation, compute a signature of the newest ply: with `plies = state.game.ptn.allPlies` and `ply = plies[plies.length - 1]`, the string `${state.game.name}|${plies.length}|${ply.id}|${ply.text}` (empty when there is no ply). A sound is considered only when a mutation in the table below **changes** the signature; then `ply` is the move that was made. (The newest ply is always last in `allPlies`, including when a tap turns the flat just placed into a wall, which replaces it under the same id.) Remember the signature after every mutation, whatever its type, so an undo followed by the same move is a change.

**Which mutations are moves.**

| Mutation                                         | Live Games | Every Move |
| ------------------------------------------------ | ---------- | ---------- |
| `game/APPEND_PLY` with `payload.playtakLive` set | plays      | plays      |
| `game/APPEND_PLY` otherwise                      | silent     | plays      |
| `game/INSERT_PLY`                                | silent     | plays      |
| `game/INSERT_PLY_INTERACTIVE`                    | silent     | plays      |
| anything else                                    | silent     | silent     |

**What to play.** `sounds = landingsOf(ply).map(({ name, player }) => ({ name, material: materialOf(state, player) }))`, then:

- If the mode is `"off"` or `soundVolume` is 0, return before touching the player.
- `game/INSERT_PLY_INTERACTIVE` with `payload.isAlreadyDone`: the pieces were set down by the taps that made the move, so play only the last sound, with no delay.
- Otherwise `player.play(sounds, { delay, gap: DROP_GAP, volume: soundVolume / 100 })` with `delay = state.ui.animateBoard ? PIECE_TRANSITION : 0`. `PIECE_TRANSITION` mirrors `$transition-duration` in `src/css/quasar.variables.scss`; say so in a comment beside it.

- [ ] **Step 5: Run the tests**

Run: `cd tests && npx playwright test e2e/piece-sounds.spec.js e2e/settings.spec.js e2e/no-page-errors.spec.js e2e/playtak-live-append.spec.js --trace off`
Expected: PASS.

- [ ] **Step 6: Listen to it**

Start the app, turn the volume up, and make a placement, a stack spread entered as text, and a capstone flattening a wall. Each should sound like its counterpart on the prototype page (`/prototype-sound/`). Report what you heard; if you can't hear, say so and leave this step for Craig.

- [ ] **Step 7: Commit**

Format, then commit with the `commit-and-push` skill: "Play a sound when a piece lands, with a setting for when and how loud".
