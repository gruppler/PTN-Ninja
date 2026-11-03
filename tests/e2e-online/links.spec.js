// @ts-check
const { test, expect } = require("@playwright/test");
const { createAccount, signIn, signInAsGuest } = require("./helpers");

// Each test drives two or three browser contexts
test.describe.configure({ timeout: 60000 });

const SYNC_TIMEOUT = 10000;
const EMPTY_5X5 = "x5/x5/x5/x5/x5 1 1";
const UNAVAILABLE = "That game is unavailable.";

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

function createGame(page, config) {
  return callFunction(page, "createGame", {
    config: { playerSeat: 1, ...config },
    tags: { size: 5, komi: 0, opening: "swap" },
    tps: EMPTY_5X5,
  });
}

function openGame(page, game) {
  return page.evaluate(
    (game) => window.app.$store.dispatch("online/OPEN_GAME", game),
    game
  );
}

/** A new browser context, with clipboard access, and its page */
async function newPage(browser) {
  const context = await browser.newContext({
    permissions: ["clipboard-read", "clipboard-write"],
  });
  return context.newPage();
}

/** Wait until the page's current game is the online game `id` */
function waitForGame(page, id) {
  return page.waitForFunction(
    (id) => {
      const store = window.app && window.app.$store;
      return (
        store &&
        store.state.online &&
        store.state.game.config &&
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

/** Open a link in the page and wait for the app to settle */
async function openLink(page, url) {
  await page.goto(url);
  await page.waitForFunction(
    () =>
      window.app &&
      window.app.$store &&
      window.app.$store.state.online &&
      window.app.$store.state.online.initialized &&
      window.app.$store.state.online.user,
    null,
    { timeout: 30000 }
  );
}

/** Copy the current game's link through Share > Copy > Full Link */
async function copyFullLink(page) {
  await page.evaluate(() => navigator.clipboard.writeText(""));
  await page.locator("#left-drawer .q-btn:has(.mdi-export)").first().click();
  await page.locator(".q-menu .q-item", { hasText: "Copy" }).click();
  await page.locator(".q-menu .q-item", { hasText: "Full Link" }).click();
  await expect
    .poll(() => page.evaluate(() => navigator.clipboard.readText()))
    .not.toBe("");
  return page.evaluate(() => navigator.clipboard.readText());
}

const joinDialog = (page) =>
  page.locator(".q-dialog", { hasText: "Join Game" });

test("Full Link copies /g/ and /p/ links that open the game elsewhere", async ({
  browser,
  baseURL,
}) => {
  const alice = await createAccount(uniqueName("Alice"));
  const alicePage = await newPage(browser);
  await signIn(alicePage, alice);

  const publicGame = await createGame(alicePage, { isPrivate: false });
  await openGame(alicePage, publicGame);
  await waitForGame(alicePage, publicGame.id);
  const publicLink = await copyFullLink(alicePage);
  expect(publicLink).toBe(`${baseURL}/g/${publicGame.id}`);

  const privateGame = await createGame(alicePage, { isPrivate: true });
  await openGame(alicePage, privateGame);
  await waitForGame(alicePage, privateGame.id);
  const privateLink = await copyFullLink(alicePage);
  expect(privateLink).toBe(`${baseURL}/p/${privateGame.id}`);

  // A guest opening each link in a fresh context gets the game
  const guestPage = await newPage(browser);
  await openLink(guestPage, publicLink);
  await waitForGame(guestPage, publicGame.id);
  expect(
    await guestPage.evaluate(() => window.app.$store.state.game.config)
  ).toMatchObject({ isOnline: true, isPrivate: false });

  const otherGuestPage = await newPage(browser);
  await openLink(otherGuestPage, privateLink);
  await waitForGame(otherGuestPage, privateGame.id);
  expect(
    await otherGuestPage.evaluate(() => window.app.$store.state.game.config)
  ).toMatchObject({ isOnline: true, isPrivate: true });
});

test("the join prompt appears once, and not again after it's dismissed", async ({
  browser,
  baseURL,
}) => {
  const [alice, bob] = await Promise.all([
    createAccount(uniqueName("Alice")),
    createAccount(uniqueName("Bob")),
  ]);
  const alicePage = await newPage(browser);
  await signIn(alicePage, alice);
  const game = await createGame(alicePage, { isPrivate: false });
  const link = `${baseURL}/g/${game.id}`;

  const bobPage = await newPage(browser);
  await signIn(bobPage, bob);
  await openLink(bobPage, link);
  await waitForGame(bobPage, game.id);
  await expect(joinDialog(bobPage)).toBeVisible();

  await joinDialog(bobPage).getByRole("button", { name: "Spectate" }).click();
  await expect(joinDialog(bobPage)).toBeHidden();

  // Reloading the link doesn't ask again
  await openLink(bobPage, link);
  await waitForGame(bobPage, game.id);
  await bobPage.waitForTimeout(1500);
  await expect(joinDialog(bobPage)).toBeHidden();

  // Nor does a change of sign-in
  await bobPage.evaluate(() => window.app.$store.dispatch("online/LOG_OUT"));
  await bobPage.waitForFunction(
    () => window.app.$store.state.online.user.isAnonymous
  );
  await bobPage.waitForTimeout(1000);
  await expect(joinDialog(bobPage)).toBeHidden();
});

test("a private game reserved for Bob is unavailable to Carol", async ({
  browser,
  baseURL,
}) => {
  const bobName = uniqueName("Bob");
  const [alice, bob, carol] = await Promise.all([
    createAccount(uniqueName("Alice")),
    createAccount(bobName),
    createAccount(uniqueName("Carol")),
  ]);
  const alicePage = await newPage(browser);
  await signIn(alicePage, alice);
  const game = await createGame(alicePage, {
    isPrivate: true,
    opponentName: bobName,
  });
  const link = `${baseURL}/p/${game.id}`;

  const carolPage = await newPage(browser);
  await signIn(carolPage, carol);
  const before = await carolPage.evaluate(() => ({
    name: window.app.$store.state.game.list[0].name,
    count: window.app.$store.state.game.list.length,
  }));
  await openLink(carolPage, link);
  await expect(carolPage.getByText(UNAVAILABLE)).toBeVisible({
    timeout: SYNC_TIMEOUT,
  });
  // Her current game stays in place
  const after = await carolPage.evaluate(() => ({
    name: window.app.$store.state.game.list[0].name,
    count: window.app.$store.state.game.list.length,
    ids: window.app.$store.state.game.list.map((g) => g.config.id),
  }));
  expect(after.name).toBe(before.name);
  expect(after.count).toBe(before.count);
  expect(after.ids).not.toContain(game.id);

  // Bob can open it and is asked to join
  const bobPage = await newPage(browser);
  await signIn(bobPage, bob);
  await openLink(bobPage, link);
  await waitForGame(bobPage, game.id);
  await expect(joinDialog(bobPage)).toBeVisible();
});

test("a guest creates a private game and another joins it by its link", async ({
  browser,
}) => {
  const alicePage = await newPage(browser);
  await signInAsGuest(alicePage);

  // A server refusal comes back as the server's message
  const refusal = await alicePage.evaluate(async () => {
    try {
      await window.app.$store.dispatch("online/CREATE_GAME", {
        config: {
          isPrivate: true,
          playerSeat: 1,
          playerName: "Alicia",
          opponentName: "NoSuchPlayer" + Date.now(),
        },
        tags: { size: 5, komi: 0, opening: "swap" },
        tps: "x5/x5/x5/x5/x5 1 1",
      });
      return null;
    } catch (error) {
      return error.message;
    }
  });
  expect(refusal).toBe("Invalid opponent name");

  const game = await alicePage.evaluate(() =>
    window.app.$store.dispatch("online/CREATE_GAME", {
      config: {
        isPrivate: true,
        playerSeat: 1,
        playerName: "Alicia",
        scratchboard: true,
      },
      tags: { size: 5, komi: 0, opening: "swap" },
      tps: "x5/x5/x5/x5/x5 1 1",
    })
  );
  expect(game).toMatchObject({ isPrivate: true });
  await waitForGame(alicePage, game.id);
  expect(
    await alicePage.evaluate(() => window.app.$store.state.game.config)
  ).toMatchObject({ isOnline: true, id: game.id, scratchboard: true });
  const link = await alicePage.evaluate(() =>
    window.app.$store.getters["ui/url"](window.app.$game)
  );
  expect(link).toMatch(new RegExp(`/p/${game.id}$`));

  const bobPage = await newPage(browser);
  await signInAsGuest(bobPage);
  await openLink(bobPage, link);
  await waitForGame(bobPage, game.id);
  const dialog = joinDialog(bobPage);
  await expect(dialog).toBeVisible();
  await dialog.getByLabel("Player Name").fill("Bobby");
  await dialog.getByRole("button", { name: "Play", exact: true }).click();
  await expect(dialog).toBeHidden();

  // Both clients see the seat filled, and the local game keeps its online
  // config and takes a name with both players
  for (const [page, seat] of [
    [alicePage, 1],
    [bobPage, 2],
  ]) {
    await expect
      .poll(
        () =>
          page.evaluate(() => {
            const state = window.app.$store.state.game;
            return {
              players: state.config.players.every(Boolean),
              player2: state.ptn.tags.player2,
            };
          }),
        { timeout: SYNC_TIMEOUT }
      )
      .toEqual({ players: true, player2: "Bobby" });
    const config = await page.evaluate(
      () => window.app.$store.state.game.config
    );
    expect(config).toMatchObject({
      isOnline: true,
      id: game.id,
      isPrivate: true,
      player: seat,
    });
    expect(config).toHaveProperty("syncedMainline");
    await expect
      .poll(() =>
        page.evaluate(() => [
          window.app.$game.name,
          window.app.$store.state.game.list[0].name,
        ])
      )
      .toEqual([
        expect.stringMatching(/^Alicia vs Bobby 5x5/),
        expect.stringMatching(/^Alicia vs Bobby 5x5/),
      ]);
  }
});

test("only the latest OPEN_GAME switches the current game", async ({
  browser,
}) => {
  const page = await newPage(browser);
  await signInAsGuest(page);
  const first = await createGame(page, {
    isPrivate: true,
    playerName: "Guesty",
  });
  const second = await createGame(page, {
    isPrivate: true,
    playerName: "Guesty",
  });
  // The second one is already open, so opening it again only selects it
  await openGame(page, second);
  await page.evaluate(() =>
    window.app.$store.dispatch("game/SELECT_GAME", { index: 1 })
  );
  await page.waitForFunction(
    (id) => window.app.$store.state.game.config.id !== id,
    second.id
  );

  await page.evaluate(
    ([first, second]) => {
      const store = window.app.$store;
      return Promise.all([
        store.dispatch("online/OPEN_GAME", first),
        store.dispatch("online/OPEN_GAME", second),
      ]);
    },
    [first, second]
  );
  await page.waitForTimeout(500);
  expect(
    await page.evaluate(() => window.app.$store.state.game.config.id)
  ).toBe(second.id);
});
