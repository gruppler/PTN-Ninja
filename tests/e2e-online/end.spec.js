// @ts-check
const { test, expect } = require("@playwright/test");
const { createAccount, signIn } = require("./helpers");

const SYNC_TIMEOUT = 5000;

let counter = 0;
const uniqueName = (prefix) =>
  `${prefix}${Date.now().toString(36)}${counter++}`;

/** Call a Cloud Function from the page as its signed-in user */
function callFunction(page, name, data) {
  return page.evaluate(
    async ({ name, data }) => {
      const { data: result } = await window.functions.httpsCallable(name)(data);
      return result;
    },
    { name, data }
  );
}

function openGame(page, game) {
  return page.evaluate(
    (game) => window.app.$store.dispatch("online/OPEN_GAME", game),
    game
  );
}

/** Main-line ply texts of the page's current local game */
function mainline(page) {
  return page.evaluate(() =>
    window.app.$game.plies
      .filter((ply) => !ply.branch && ply.text !== "--")
      .map((ply) => ply.text)
  );
}

/** Place a flat on a square through the store, as a board click does */
function place(page, square) {
  return page.evaluate(
    (square) =>
      window.app.$store.dispatch("game/SELECT_SQUARE", {
        square,
        alt: false,
        selectedPiece: window.app.$store.state.ui.selectedPiece,
      }),
    square
  );
}

const serverCount = (page) =>
  page.evaluate(() => window.app.$store.getters["online/syncedPlyCount"]);

/**
 * Alice (player 1) and Bob (player 2) in a public 5x5 game from a TPS, both
 * with it open
 */
async function startGame(browser, tps) {
  const [alice, bob] = await Promise.all([
    createAccount(uniqueName("Alice")),
    createAccount(uniqueName("Bob")),
  ]);
  const alicePage = await (await browser.newContext()).newPage();
  const bobPage = await (await browser.newContext()).newPage();
  await Promise.all([signIn(alicePage, alice), signIn(bobPage, bob)]);

  const game = await callFunction(alicePage, "createGame", {
    config: { isPrivate: false, playerSeat: 1 },
    tags: { size: 5, komi: 0, opening: "swap" },
    tps,
  });
  await openGame(alicePage, game);
  await openGame(bobPage, game);
  await callFunction(bobPage, "joinGame", game);
  await alicePage.waitForFunction(
    () =>
      window.app.$store.state.online.currentGame.game.config.players.every(
        Boolean
      ),
    null,
    { timeout: SYNC_TIMEOUT }
  );
  return { game, alicePage, bobPage };
}

const expectEnded = async (pages, result) => {
  for (const page of pages) {
    await page.waitForFunction(
      () => window.app.$store.getters["online/hasEnded"],
      null,
      { timeout: SYNC_TIMEOUT }
    );
    // Play mode is off: analysis is available and the play footer is gone
    await expect(page.locator(".gameplay-controls")).toHaveCount(0);
    expect(
      await page.evaluate(() => {
        const find = (vm) =>
          vm.$options.name === "MainLayout"
            ? vm
            : vm.$children.reduce((found, child) => found || find(child), null);
        return find(window.app).hasAnalysis;
      })
    ).toBe(true);
    expect(
      await page.evaluate(() => window.app.$store.getters["online/hasEnded"])
    ).toBe(true);
    // The result is in the move list, after the last ply
    await expect(page.locator(".ptn.result").first()).toBeVisible({
      timeout: SYNC_TIMEOUT,
    });
    await expect(page.locator(".ptn.result").first()).toHaveText(
      result.replace("1/2-1/2", "½½").replace("-", "")
    );
    expect(await page.evaluate(() => window.app.$game.tag("result"))).toBe(
      result
    );
  }
};

/** No further move is accepted on either board */
const expectNoMoves = async (pages) => {
  const before = await Promise.all(pages.map(mainline));
  for (const page of pages) {
    await place(page, "c3");
    await place(page, "d3");
  }
  await pages[0].waitForTimeout(500);
  expect(await Promise.all(pages.map(mainline))).toEqual(before);
};

test("a road win ends the game on both clients", async ({ browser }) => {
  const { alicePage, bobPage } = await startGame(
    browser,
    "x5/x5/x5/x5/1,1,1,1,x 1 5"
  );
  await expect(alicePage.locator(".gameplay-controls")).toBeVisible();
  await expect(alicePage.locator(".resign-button")).toBeEnabled();

  await place(alicePage, "e1");
  await expectEnded([alicePage, bobPage], "R-0");
  await expectNoMoves([alicePage, bobPage]);
  expect(await serverCount(alicePage)).toBe(1);
});

test("resigning ends the game and shows the result after the last ply", async ({
  browser,
}) => {
  const { game, alicePage, bobPage } = await startGame(
    browser,
    "x5/x5/x5/x5/x5 1 1"
  );
  await place(alicePage, "a1");
  await expect
    .poll(() => serverCount(bobPage), { timeout: SYNC_TIMEOUT })
    .toBe(1);
  await bobPage.evaluate(
    (game) =>
      window.functions.httpsCallable("insertPly")({
        ...game,
        ply: "e5",
        plyIndex: 1,
      }),
    game
  );
  await expect
    .poll(() => serverCount(alicePage), { timeout: SYNC_TIMEOUT })
    .toBe(2);
  await alicePage.locator(".resign-button").click();
  await alicePage.locator(".q-dialog .q-btn", { hasText: "OK" }).click();

  await expectEnded([alicePage, bobPage], "0-1");
  await expectNoMoves([alicePage, bobPage]);
});

test("player 2 resigning gives 1-0", async ({ browser }) => {
  const { alicePage, bobPage } = await startGame(browser, "x5/x5/x5/x5/x5 1 1");
  await place(alicePage, "a1");
  await expect
    .poll(() => serverCount(bobPage), { timeout: SYNC_TIMEOUT })
    .toBe(1);
  await bobPage.locator(".resign-button").click();
  await bobPage.locator(".q-dialog .q-btn", { hasText: "OK" }).click();

  await expectEnded([alicePage, bobPage], "1-0");
  await expectNoMoves([alicePage, bobPage]);
  // The result follows the last ply
  await expect(
    alicePage.locator(".ptn.ply[data-ply-text='a1'] .ptn.result").first()
  ).toBeVisible();
});

const FORCED = ["flatCounts", "stackCounts", "showRoads", "scratchboard"];
const forcedOff = (page) =>
  page.evaluate(
    (forced) =>
      window.app.$store.getters["game/disabledOptions"].filter((option) =>
        forced.includes(option)
      ),
    FORCED
  );

/** Ply texts and players of the current game's branch plies */
const branchPlies = (page) =>
  page.evaluate(() =>
    window.app.$game.plies
      .filter((ply) => ply.branch)
      .map((ply) => [ply.text, ply.player])
  );

test("after a road win, the forced settings lift and a player explores both colours", async ({
  browser,
}) => {
  const { alicePage, bobPage } = await startGame(
    browser,
    "x5/x5/x5/x5/1,1,1,1,x 1 5"
  );
  // The game was created without these settings: they're forced off in play
  for (const page of [alicePage, bobPage]) {
    expect((await forcedOff(page)).sort()).toEqual([...FORCED].sort());
  }

  await place(alicePage, "e1");
  await expectEnded([alicePage, bobPage], "R-0");
  for (const page of [alicePage, bobPage]) {
    await expect.poll(() => forcedOff(page)).toEqual([]);
  }

  // Alice (player 1) explores a branch from the start, playing both sides
  await alicePage.evaluate(() => window.app.$store.dispatch("game/FIRST"));
  await place(alicePage, "c3");
  await place(alicePage, "d3");
  await expect
    .poll(() => branchPlies(alicePage))
    .toEqual([
      ["c3", 1],
      ["d3", 2],
    ]);
  // The main line stays as the server has it
  expect(await mainline(alicePage)).toEqual(["e1"]);
  expect(await serverCount(alicePage)).toBe(1);
});

test("resigning a forced-setting game lifts the lock too", async ({
  browser,
}) => {
  const { alicePage } = await startGame(browser, "x5/x5/x5/x5/x5 1 1");
  expect((await forcedOff(alicePage)).length).toBe(FORCED.length);
  await alicePage.locator(".resign-button").click();
  await alicePage.locator(".q-dialog .q-btn", { hasText: "OK" }).click();
  await alicePage.waitForFunction(
    () => window.app.$store.getters["online/hasEnded"],
    null,
    { timeout: SYNC_TIMEOUT }
  );
  await expect.poll(() => forcedOff(alicePage)).toEqual([]);
});

test("Resign is unavailable, and refused, while a seat is open", async ({
  browser,
}) => {
  const alice = await createAccount(uniqueName("Alice"));
  const alicePage = await (await browser.newContext()).newPage();
  await signIn(alicePage, alice);
  const game = await callFunction(alicePage, "createGame", {
    config: { isPrivate: false, playerSeat: 1 },
    tags: { size: 5, komi: 0, opening: "swap" },
    tps: "x5/x5/x5/x5/x5 1 1",
  });
  await openGame(alicePage, game);
  await expect(alicePage.locator(".resign-button")).toBeVisible();
  await expect(alicePage.locator(".resign-button")).toBeDisabled();

  const error = await alicePage.evaluate(
    (game) =>
      window.functions
        .httpsCallable("resign")(game)
        .then(
          () => null,
          (error) => error.code
        ),
    game
  );
  expect(error).toBe("failed-precondition");
  expect(
    await alicePage.evaluate(() => window.app.$store.getters["online/hasEnded"])
  ).toBe(false);
});

test("an older snapshot doesn't overwrite newer game data", async ({
  browser,
}) => {
  const { alicePage } = await startGame(browser, "x5/x5/x5/x5/x5 1 1");
  await place(alicePage, "a1");
  await expect
    .poll(() => serverCount(alicePage), { timeout: SYNC_TIMEOUT })
    .toBe(1);
  // Replay the game doc and root branch as they were before the move
  const after = await alicePage.evaluate(async () => {
    const store = window.app.$store;
    const current = store.state.online.currentGame;
    const old = new Date(current.game.updatedAt.getTime() - 60000);
    await store.dispatch("online/APPLY_REMOTE", {
      id: current.id,
      isPrivate: current.isPrivate,
      game: {
        ...current.game,
        state: { ...current.game.state, plyIndex: 0 },
        updatedAt: old,
      },
      root: { ...current.root, plies: [], updatedAt: old },
    });
    const now = store.state.online.currentGame;
    return {
      plyIndex: now.game.state.plyIndex,
      plies: now.root.plies.length,
    };
  });
  expect(after).toEqual({ plyIndex: 1, plies: 1 });
  expect(await mainline(alicePage)).toEqual(["a1"]);
});
