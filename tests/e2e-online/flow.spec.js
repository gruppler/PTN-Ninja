// @ts-check
/**
 * The whole online flow with two players. Games are created through the Play
 * Online dialog and opened through the online games dialog; moves are played
 * through the same store action a board click uses, and joining goes through
 * the prompt that appears on opening a joinable game from the list.
 */
const { test, expect } = require("@playwright/test");
const { createAccount, signIn, signInAsGuest, openApp } = require("./helpers");

test.describe.configure({ timeout: 120000 });

const SYNC_TIMEOUT = 8000;

let counter = 0;
const uniqueName = (prefix) =>
  `${prefix}${Date.now().toString(36)}${counter++}`;

async function newPage(browser) {
  return (await browser.newContext()).newPage();
}

const go = (page, name, params) =>
  page.evaluate(
    async ({ name, params }) => {
      await window.app.$router.push({ name, params }).catch(() => {});
    },
    { name, params }
  );

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

/** Main-line ply texts of the page's current local game */
const mainline = (page) =>
  page.evaluate(() =>
    window.app.$game.plies
      .filter((ply) => !ply.branch && ply.text !== "--")
      .map((ply) => ply.text)
  );

/** The server's main line for the current game, read from the Vuex output */
const serverPlies = (page) =>
  page.evaluate(() => {
    const current = window.app.$store.state.online.currentGame;
    return current && current.root
      ? current.root.plies.map((ply) => ply.ply)
      : [];
  });

const currentID = (page) =>
  page.evaluate(() => window.app.$store.state.game.config.id);

async function waitForGame(page, id) {
  await page.waitForFunction(
    (id) => {
      const store = window.app.$store;
      return (
        store.state.game.config.isOnline &&
        store.state.game.config.id === id &&
        store.state.online.currentGame &&
        store.state.online.currentGame.id === id
      );
    },
    id,
    { timeout: 30000 }
  );
}

/** Fill and submit the New Game tab in Online mode */
async function createThroughDialog(page, { isPrivate, playerName, size }) {
  await go(page, "play-online");
  const dialog = page.locator(".q-dialog", { hasText: "Load Game" });
  await expect(dialog).toBeVisible();

  // Public/private follows the account; check it rather than assume it
  const toggle = dialog.locator(".q-toggle").first();
  const checked = (await toggle.getAttribute("aria-checked")) === "true";
  if (checked !== isPrivate) {
    await toggle.click();
  }
  if (playerName) {
    await dialog.getByLabel("Player Name").fill(playerName);
  }

  // Seat: Player 1
  await dialog.locator(".q-btn-toggle .q-btn", { hasText: "Player 1" }).click();

  await dialog.locator(".q-select", { hasText: "Size" }).click();
  await page
    .locator(".q-menu .q-item", { hasText: new RegExp(`^\\s*${size}x${size}`) })
    .click();

  await dialog.getByRole("button", { name: "Create", exact: true }).click();
  await expect(dialog).toBeHidden({ timeout: 20000 });
}

async function selectFilter(page, label) {
  await page
    .locator(".game-table .q-btn-group .q-btn", { hasText: label })
    .click();
}

const rowIDs = (page) =>
  page.evaluate(() => {
    const table = document.querySelector(".game-table").__vue__;
    return table.data.map((game) => game.config.id);
  });

async function openDialog(page, filter) {
  await go(page, "load-online", filter ? { filter } : undefined);
  await expect(page.locator(".game-table")).toBeVisible();
}

test("two players play a public game to a road win, one reloads, a guest game ends in a resignation, and Mine lists them right", async ({
  browser,
}) => {
  const [alice, bob] = await Promise.all([
    createAccount(uniqueName("Alice")),
    createAccount(uniqueName("Bob")),
  ]);
  const alicePage = await newPage(browser);
  const bobPage = await newPage(browser);
  await Promise.all([signIn(alicePage, alice), signIn(bobPage, bob)]);
  const aliceName = await alicePage.evaluate(
    () => window.app.$store.state.online.user.displayName
  );

  // --- Alice creates a public 3x3 game through the Play Online dialog
  await createThroughDialog(alicePage, { isPrivate: false, size: 3 });
  const game1 = await currentID(alicePage);
  expect(game1).toBeTruthy();
  await waitForGame(alicePage, game1);
  expect(
    await alicePage.evaluate(() => window.app.$store.state.game.config)
  ).toMatchObject({ isOnline: true, isPrivate: false, player: 1 });

  // --- Bob finds it in the Open list and opens it with OK
  await openDialog(bobPage, "open");
  await expect
    .poll(() => rowIDs(bobPage), { timeout: SYNC_TIMEOUT })
    .toContain(game1);
  await bobPage
    .locator(".game-table tbody tr", { hasText: aliceName })
    .first()
    .click();
  await bobPage.getByRole("button", { name: "OK", exact: true }).click();
  await waitForGame(bobPage, game1);
  await expect(bobPage.locator(".game-table")).toBeHidden();

  // --- ...is asked to join, and does
  const joinDialog = bobPage.locator(".q-dialog", { hasText: "Join Game" });
  await expect(joinDialog).toBeVisible();
  await joinDialog.getByRole("button", { name: "Play", exact: true }).click();
  await expect(joinDialog).toBeHidden();
  for (const page of [alicePage, bobPage]) {
    await page.waitForFunction(
      () => window.app.$store.state.game.config.players.every(Boolean),
      null,
      { timeout: SYNC_TIMEOUT }
    );
  }
  expect(
    await bobPage.evaluate(() => window.app.$store.state.game.config.player)
  ).toBe(2);

  // --- They alternate moves: Alice a1 (a black flat), Bob c3 (a white flat),
  // then Alice c2, Bob b2, and Alice c1 completes the white road c1-c3.
  await place(alicePage, "a1");
  await expect
    .poll(() => mainline(bobPage), { timeout: SYNC_TIMEOUT })
    .toEqual(["a1"]);
  await place(bobPage, "c3");
  await expect
    .poll(() => mainline(alicePage), { timeout: SYNC_TIMEOUT })
    .toEqual(["a1", "c3"]);
  await place(alicePage, "c2");
  await expect
    .poll(() => mainline(bobPage), { timeout: SYNC_TIMEOUT })
    .toEqual(["a1", "c3", "c2"]);

  // --- Bob reloads mid-game: the board comes back matching the server
  await bobPage.reload();
  await openApp(bobPage);
  await waitForGame(bobPage, game1);
  await expect
    .poll(() => mainline(bobPage), { timeout: SYNC_TIMEOUT })
    .toEqual(["a1", "c3", "c2"]);
  expect(await serverPlies(bobPage)).toEqual(["a1", "c3", "c2"]);
  expect(
    await bobPage.evaluate(() => window.app.$store.state.game.config.player)
  ).toBe(2);

  // --- ...and again immediately after sending a move
  await place(bobPage, "b2");
  await bobPage.reload();
  await openApp(bobPage);
  await waitForGame(bobPage, game1);
  // Whatever the server holds is what Bob's board shows, and Alice agrees
  await expect
    .poll(
      async () => {
        const [local, server] = [
          await mainline(bobPage),
          await serverPlies(bobPage),
        ];
        return JSON.stringify(local) === JSON.stringify(server) ? server : null;
      },
      { timeout: SYNC_TIMEOUT }
    )
    .not.toBeNull();
  // The move reached the server despite the reload, and Alice has it
  await expect
    .poll(() => mainline(alicePage), { timeout: SYNC_TIMEOUT })
    .toEqual(["a1", "c3", "c2", "b2"]);
  await expect
    .poll(() => mainline(bobPage), { timeout: SYNC_TIMEOUT })
    .toEqual(["a1", "c3", "c2", "b2"]);
  expect(await serverPlies(bobPage)).toEqual(["a1", "c3", "c2", "b2"]);

  // --- Alice finishes the road; the game ends for both
  await place(alicePage, "c1");
  for (const page of [alicePage, bobPage]) {
    await page.waitForFunction(
      () => window.app.$store.getters["online/hasEnded"],
      null,
      { timeout: SYNC_TIMEOUT }
    );
    expect(await page.evaluate(() => window.app.$game.tag("result"))).toBe(
      "R-0"
    );
    expect(await mainline(page)).toEqual(["a1", "c3", "c2", "b2", "c1"]);
  }
  expect(await serverPlies(bobPage)).toEqual(["a1", "c3", "c2", "b2", "c1"]);

  // --- A guest creates a private game through the dialog; Alice joins it by
  // its link
  const guestPage = await newPage(browser);
  await signInAsGuest(guestPage);
  await createThroughDialog(guestPage, {
    isPrivate: true,
    playerName: "Gus",
    size: 3,
  });
  const game2 = await currentID(guestPage);
  expect(game2).toBeTruthy();
  await waitForGame(guestPage, game2);
  const link = await guestPage.evaluate(() =>
    window.app.$store.getters["ui/url"](window.app.$game)
  );
  expect(link).toMatch(new RegExp(`/p/${game2}$`));

  await alicePage.goto(link);
  await alicePage.waitForFunction(
    () => {
      const online = window.app && window.app.$store.state.online;
      return online && online.initialized && online.user;
    },
    null,
    { timeout: 30000 }
  );
  await waitForGame(alicePage, game2);
  const aliceJoin = alicePage.locator(".q-dialog", { hasText: "Join Game" });
  await expect(aliceJoin).toBeVisible();
  await aliceJoin.getByRole("button", { name: "Play", exact: true }).click();
  await expect(aliceJoin).toBeHidden();
  for (const page of [alicePage, guestPage]) {
    await page.waitForFunction(
      () => window.app.$store.state.game.config.players.every(Boolean),
      null,
      { timeout: SYNC_TIMEOUT }
    );
  }
  expect(
    await alicePage.evaluate(() => window.app.$store.state.game.config.player)
  ).toBe(2);

  // --- The guest moves, Alice resigns, the game ends 1-0 for both
  await place(guestPage, "a1");
  await expect
    .poll(() => mainline(alicePage), { timeout: SYNC_TIMEOUT })
    .toEqual(["a1"]);
  await alicePage.locator(".resign-button").click();
  await alicePage.locator(".q-dialog .q-btn", { hasText: "OK" }).click();
  for (const page of [alicePage, guestPage]) {
    await page.waitForFunction(
      () => window.app.$store.getters["online/hasEnded"],
      null,
      { timeout: SYNC_TIMEOUT }
    );
    expect(await page.evaluate(() => window.app.$game.tag("result"))).toBe(
      "1-0"
    );
  }

  // --- Mine lists each player's own games, and finished ones under Recent
  // Mine has exactly my games; the finished public game is also in Recent,
  // the private one is in no list but Mine, and neither is Ongoing
  const expectLists = async (page, mine) => {
    await openDialog(page, "mine");
    await expect
      .poll(async () => (await rowIDs(page)).sort(), {
        timeout: SYNC_TIMEOUT,
      })
      .toEqual([...mine].sort());
    // Recent has loaded once it lists the finished public game; only then is
    // its absence from Ongoing (checked after) meaningful
    await selectFilter(page, "Recent");
    await expect
      .poll(() => rowIDs(page), { timeout: SYNC_TIMEOUT })
      .toContain(game1);
    expect(await rowIDs(page)).not.toContain(game2);
    await selectFilter(page, "Ongoing");
    await expect
      .poll(() => rowIDs(page), { timeout: SYNC_TIMEOUT })
      .not.toContain(game1);
    expect(await rowIDs(page)).not.toContain(game2);
  };
  await expectLists(alicePage, [game1, game2]);
  await expectLists(bobPage, [game1]);
  await expectLists(guestPage, [game2]);
});
