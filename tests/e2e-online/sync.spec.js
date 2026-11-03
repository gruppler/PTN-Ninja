// @ts-check
const { test, expect } = require("@playwright/test");
const { createAccount, signIn, signInAsGuest } = require("./helpers");

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

/** Ply texts that live in branches of the page's current local game */
function branchPlies(page) {
  return page.evaluate(() =>
    window.app.$game.plies.filter((ply) => ply.branch).map((ply) => ply.text)
  );
}

/** Ply texts of the server's root branch, as the page's store sees it */
function serverPlies(page) {
  return page.evaluate(() => {
    const current = window.app.$store.state.online.currentGame;
    return current && current.root
      ? current.root.plies.map((ply) => ply.ply)
      : [];
  });
}

/**
 * Make a move on the server as the page's user, once the page sees it's
 * their turn and has the main line up to it
 */
async function play(page, game, ply) {
  const plyIndex = await page
    .waitForFunction(
      () => {
        const getters = window.app.$store.getters;
        const state = getters["online/currentState"];
        const synced = getters["online/syncedPlyCount"];
        // A string, so that a ply index of 0 still counts as ready
        return getters["online/isMyTurn"] && state.plyIndex === synced
          ? String(synced)
          : null;
      },
      null,
      { timeout: SYNC_TIMEOUT }
    )
    .then((handle) => handle.jsonValue())
    .then(Number);
  return callFunction(page, "insertPly", { ...game, ply, plyIndex });
}

/** Append a local, unsent ply to the end of the page's main line */
function playLocally(page, ply) {
  return page.evaluate(
    (ply) => window.app.$store.dispatch("game/APPEND_PLY", ply),
    ply
  );
}

const expectMainline = (page, plies) =>
  expect.poll(() => mainline(page), { timeout: SYNC_TIMEOUT }).toEqual(plies);

/**
 * Alice creates a public 5x5 game as player 1 and opens it; Bob joins as
 * player 2 and opens it. Returns the pages and the game's { id, isPrivate }.
 */
async function startGame(browser) {
  const bobName = uniqueName("Bob");
  const [alice, bob] = await Promise.all([
    createAccount(uniqueName("Alice")),
    createAccount(bobName),
  ]);
  const aliceContext = await browser.newContext();
  const bobContext = await browser.newContext();
  const alicePage = await aliceContext.newPage();
  const bobPage = await bobContext.newPage();
  await Promise.all([signIn(alicePage, alice), signIn(bobPage, bob)]);

  const game = await callFunction(alicePage, "createGame", {
    config: { isPrivate: false, playerSeat: 1 },
    tags: { size: 5, komi: 0, opening: "swap" },
    tps: "x5/x5/x5/x5/x5 1 1",
  });
  expect(await openGame(alicePage, game)).toEqual({ joinable: false });

  expect(await openGame(bobPage, game)).toEqual({ joinable: true });
  await callFunction(bobPage, "joinGame", game);

  return { game, bobName, alicePage, bobPage, aliceContext, bobContext };
}

test("moves made by either player appear on the other's board", async ({
  browser,
}) => {
  const { game, bobName, alicePage, bobPage } = await startGame(browser);

  // Bob's joining reaches Alice's player tags
  await expect
    .poll(
      () =>
        alicePage.evaluate(() => window.app.$store.state.game.ptn.tags.player2),
      { timeout: SYNC_TIMEOUT }
    )
    .toBe(bobName);

  await play(alicePage, game, "a1");
  await expectMainline(bobPage, ["a1"]);
  await expectMainline(alicePage, ["a1"]);

  await play(bobPage, game, "e5");
  await expectMainline(alicePage, ["a1", "e5"]);
  await expectMainline(bobPage, ["a1", "e5"]);

  await play(alicePage, game, "c3");
  await expectMainline(bobPage, ["a1", "e5", "c3"]);

  // The synced count follows the server, and nothing landed in a branch
  for (const page of [alicePage, bobPage]) {
    expect(
      await page.evaluate(() => window.app.$store.state.game.config)
    ).toMatchObject({ isOnline: true, id: game.id, syncedMainline: 3 });
    expect(await branchPlies(page)).toEqual([]);
  }

  // Bob is player 2 now that he has joined
  await expect
    .poll(() =>
      bobPage.evaluate(() => window.app.$store.state.game.config.player)
    )
    .toBe(2);
});

test("a spectator sees the same main line", async ({ browser }) => {
  const { game, alicePage, bobPage } = await startGame(browser);
  await play(alicePage, game, "a1");
  await play(bobPage, game, "e5");

  const spectatorContext = await browser.newContext();
  const spectatorPage = await spectatorContext.newPage();
  await signInAsGuest(spectatorPage);
  expect(await openGame(spectatorPage, game)).toEqual({ joinable: false });
  await expectMainline(spectatorPage, ["a1", "e5"]);

  await play(alicePage, game, "c3");
  await expectMainline(spectatorPage, ["a1", "e5", "c3"]);
  expect(await serverPlies(spectatorPage)).toEqual(["a1", "e5", "c3"]);
});

test("the same game open in two tabs stays in step without duplicates", async ({
  browser,
}) => {
  const { game, alicePage, bobPage, aliceContext } = await startGame(browser);
  const aliceTab2 = await aliceContext.newPage();
  await aliceTab2.goto("/");
  await aliceTab2.waitForFunction(
    () => {
      const online = window.app && window.app.$store.state.online;
      return online && online.initialized && online.user;
    },
    null,
    { timeout: 30000 }
  );
  await openGame(aliceTab2, game);

  await play(alicePage, game, "a1");
  await play(bobPage, game, "e5");
  await play(aliceTab2, game, "c3");
  await play(bobPage, game, "d4");

  const expected = ["a1", "e5", "c3", "d4"];
  for (const page of [alicePage, aliceTab2, bobPage]) {
    await expectMainline(page, expected);
    expect(await page.evaluate(() => window.app.$game.plies.length)).toBe(
      expected.length
    );
  }
});

test("a diverging opponent move turns the local continuation into a branch", async ({
  browser,
}) => {
  const { game, alicePage, bobPage } = await startGame(browser);
  await play(alicePage, game, "a1");
  await play(bobPage, game, "e5");
  await play(alicePage, game, "b1");
  await expectMainline(alicePage, ["a1", "e5", "b1"]);

  // Alice guesses Bob's reply and her answer to it, without sending either
  await playLocally(alicePage, "d4");
  await playLocally(alicePage, "c1");
  await expectMainline(alicePage, ["a1", "e5", "b1", "d4", "c1"]);

  await play(bobPage, game, "d3");
  await expectMainline(alicePage, ["a1", "e5", "b1", "d3"]);
  expect(await branchPlies(alicePage)).toEqual(["d4", "c1"]);
  expect(await serverPlies(alicePage)).toEqual(["a1", "e5", "b1", "d3"]);
  expect(
    await alicePage.evaluate(
      () => window.app.$store.state.game.config.syncedMainline
    )
  ).toBe(4);
});

test("a matching opponent move keeps the local continuation on the main line", async ({
  browser,
}) => {
  const { game, alicePage, bobPage } = await startGame(browser);
  await play(alicePage, game, "a1");
  await play(bobPage, game, "e5");
  await play(alicePage, game, "b1");
  await expectMainline(alicePage, ["a1", "e5", "b1"]);

  await playLocally(alicePage, "d4");
  await playLocally(alicePage, "c1");

  await play(bobPage, game, "d4");
  await expect
    .poll(
      () =>
        alicePage.evaluate(
          () => window.app.$store.state.game.config.syncedMainline
        ),
      { timeout: SYNC_TIMEOUT }
    )
    .toBe(4);
  expect(await mainline(alicePage)).toEqual(["a1", "e5", "b1", "d4", "c1"]);
  expect(await branchPlies(alicePage)).toEqual([]);
});
