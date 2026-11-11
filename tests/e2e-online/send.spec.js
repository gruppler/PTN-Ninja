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

const expectMainline = (page, plies) =>
  expect.poll(() => mainline(page), { timeout: SYNC_TIMEOUT }).toEqual(plies);

const expectServer = (page, plies) =>
  expect
    .poll(() => serverPlies(page), { timeout: SYNC_TIMEOUT })
    .toEqual(plies);

const sendMode = (page) =>
  page.evaluate(() => window.app.$store.state.ui.onlineSendMode);

/** Switch the page's send mode with the Auto-send switch in the footer */
async function setSendMode(page, mode) {
  if ((await sendMode(page)) !== mode) {
    await submitButton(page).click({ button: "right" });
    await page.locator(".send-mode-menu .q-item").click();
    await expect(page.locator(".send-mode-menu")).toHaveCount(0);
  }
  expect(await sendMode(page)).toBe(mode);
}

/** Dimmed (unsent) plies with this text, in the move list or current move */
const unsent = (page, ply) =>
  page.locator(`.ptn.ply.unsent[data-ply-text="${ply}"]`);

const undoButton = (page) => page.locator(".gameplay-controls .undo-button");
const submitButton = (page) =>
  page.locator(".gameplay-controls .submit-button");

/**
 * Alice creates a public 5x5 game as player 1 and opens it; Bob joins as
 * player 2 and opens it. Returns the pages and the game's { id, isPrivate }.
 */
async function startGame(browser, { scratchboard = false } = {}) {
  const [alice, bob] = await Promise.all([
    createAccount(uniqueName("Alice")),
    createAccount(uniqueName("Bob")),
  ]);
  const aliceContext = await browser.newContext();
  const bobContext = await browser.newContext();
  const alicePage = await aliceContext.newPage();
  const bobPage = await bobContext.newPage();
  await Promise.all([signIn(alicePage, alice), signIn(bobPage, bob)]);

  const game = await callFunction(alicePage, "createGame", {
    config: { isPrivate: false, playerSeat: 1, scratchboard },
    tags: { size: 5, komi: 0, opening: "swap" },
    tps: "x5/x5/x5/x5/x5 1 1",
  });
  await openGame(alicePage, game);
  await openGame(bobPage, game);
  await callFunction(bobPage, "joinGame", game);
  // Alice sees Bob seated before she plays
  await alicePage.waitForFunction(
    () => {
      const players =
        window.app.$store.state.online.currentGame.game.config.players;
      return players.every(Boolean);
    },
    null,
    { timeout: SYNC_TIMEOUT }
  );

  return { game, alicePage, bobPage, aliceContext, bobContext };
}

test("auto-send sends a move as soon as it's placed", async ({ browser }) => {
  const { game, alicePage, bobPage } = await startGame(browser);
  expect(await sendMode(alicePage)).toBe("auto");
  await expect(
    alicePage.locator(".gameplay-controls .auto-send-mode")
  ).toBeVisible();

  await place(alicePage, "a1");
  await expectMainline(bobPage, ["a1"]);
  await expectServer(alicePage, ["a1"]);
  await expect(unsent(alicePage, "a1")).toHaveCount(0, {
    timeout: SYNC_TIMEOUT,
  });
});

test("Send opens the Auto-send switch when no move is waiting", async ({
  browser,
}) => {
  const { alicePage } = await startGame(browser);
  const menu = alicePage.locator(".send-mode-menu");
  expect(await sendMode(alicePage)).toBe("auto");

  await submitButton(alicePage).click();
  await expect(menu).toHaveCount(1);
  await menu.locator(".q-item").click();
  await expect(menu).toHaveCount(0);
  expect(await sendMode(alicePage)).toBe("submit");
});

test("submit mode holds a move until Submit is pressed", async ({
  browser,
}) => {
  const { alicePage, bobPage } = await startGame(browser);
  await setSendMode(alicePage, "submit");
  await expect(submitButton(alicePage)).toBeVisible();
  await expect(submitButton(alicePage)).not.toHaveClass(/can-send/);

  await place(alicePage, "a1");
  await expectMainline(alicePage, ["a1"]);
  await expect(unsent(alicePage, "a1").first()).toBeVisible();
  await alicePage.waitForTimeout(1000);
  expect(await serverPlies(alicePage)).toEqual([]);
  expect(await mainline(bobPage)).toEqual([]);

  await submitButton(alicePage).click();
  await expectMainline(bobPage, ["a1"]);
  await expectServer(alicePage, ["a1"]);
  await expect(unsent(alicePage, "a1")).toHaveCount(0, {
    timeout: SYNC_TIMEOUT,
  });
});

test("without scratchboard, nothing more can be played until the move is sent", async ({
  browser,
}) => {
  const { game, alicePage, bobPage } = await startGame(browser);
  await setSendMode(alicePage, "submit");

  await place(alicePage, "a1");
  await expectMainline(alicePage, ["a1"]);
  // Refused: a1 hasn't been sent
  await place(alicePage, "e5");
  expect(await mainline(alicePage)).toEqual(["a1"]);

  await submitButton(alicePage).click();
  await expectServer(alicePage, ["a1"]);
  // Still refused: it's Bob's turn
  await place(alicePage, "e5");
  expect(await mainline(alicePage)).toEqual(["a1"]);

  await play(bobPage, game, "e5");
  await expectMainline(alicePage, ["a1", "e5"]);

  // Refused away from the end of the server's main line, even where the
  // board would take a move of Alice's
  await alicePage.evaluate(() => window.app.$store.dispatch("game/FIRST"));
  await place(alicePage, "c3");
  expect(await mainline(alicePage)).toEqual(["a1", "e5"]);
  expect(await branchPlies(alicePage)).toEqual([]);
  await alicePage.evaluate(() => window.app.$store.dispatch("game/LAST"));

  await place(alicePage, "b1");
  await expectMainline(alicePage, ["a1", "e5", "b1"]);
  // The unsent move's stone type can still be changed
  await place(alicePage, "b1");
  await expectMainline(alicePage, ["a1", "e5", "Sb1"]);
  // but nothing else played
  await place(alicePage, "c3");
  expect(await mainline(alicePage)).toEqual(["a1", "e5", "Sb1"]);

  await submitButton(alicePage).click();
  await expectServer(alicePage, ["a1", "e5", "Sb1"]);
});

test("with scratchboard, plies past the next move are allowed and stay unsent", async ({
  browser,
}) => {
  const { game, alicePage, bobPage } = await startGame(browser, {
    scratchboard: true,
  });

  await place(alicePage, "a1");
  await expectServer(alicePage, ["a1"]);

  // Alice explores Bob's reply and her answer to it
  await place(alicePage, "e5");
  await place(alicePage, "b1");
  await expectMainline(alicePage, ["a1", "e5", "b1"]);
  await expect(unsent(alicePage, "e5").first()).toBeVisible();
  await expect(unsent(alicePage, "b1").first()).toBeVisible();
  await alicePage.waitForTimeout(1000);
  expect(await serverPlies(alicePage)).toEqual(["a1"]);

  // Bob plays the guessed reply, so Alice's answer is now her next move. She
  // didn't just make it, so auto-send holds it for Submit.
  await play(bobPage, game, "e5");
  await expectServer(alicePage, ["a1", "e5"]);
  await expectMainline(alicePage, ["a1", "e5", "b1"]);
  await expect(submitButton(alicePage)).toHaveClass(/can-send/);
  await alicePage.waitForTimeout(1000);
  expect(await serverPlies(alicePage)).toEqual(["a1", "e5"]);
  await expect(unsent(alicePage, "b1").first()).toBeVisible();
  expect(await sendMode(alicePage)).toBe("auto");

  await submitButton(alicePage).click();
  await expectMainline(bobPage, ["a1", "e5", "b1"]);
  await expect(unsent(alicePage, "b1")).toHaveCount(0, {
    timeout: SYNC_TIMEOUT,
  });
  await expect(
    alicePage.locator(".gameplay-controls .auto-send-mode")
  ).toBeVisible();
});

test("a move refused by the server is removed and the error shown", async ({
  browser,
}) => {
  const { game, alicePage, aliceContext } = await startGame(browser);
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

  // The first tab stops hearing from the server, and the second plays
  await alicePage.evaluate(
    (id) =>
      Promise.all([
        window.app.$store.dispatch("online/UNLISTEN", `game:${id}`),
        window.app.$store.dispatch("online/UNLISTEN", `root:${id}`),
      ]),
    game.id
  );
  await play(aliceTab2, game, "a1");

  await place(alicePage, "b1");
  await expect(
    alicePage.locator(".q-notification", { hasText: "Out of sync" })
  ).toBeVisible({ timeout: SYNC_TIMEOUT });
  await expectMainline(alicePage, []);
  expect(await branchPlies(alicePage)).toEqual([]);
  await expect(alicePage.locator(".send-failed")).toHaveCount(0);

  // Back in sync
  await alicePage.evaluate(
    (game) => window.app.$store.dispatch("online/LISTEN_GAME", game),
    game
  );
  await expectMainline(alicePage, ["a1"]);
  expect(await branchPlies(alicePage)).toEqual([]);
});

test("a failed move can be retried", async ({ browser }) => {
  const { alicePage, bobPage } = await startGame(browser);

  // The next call fails in transit
  let failed = false;
  await alicePage.route("**/insertPly", (route) => {
    if (failed) {
      return route.continue();
    }
    failed = true;
    return route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({
        error: { status: "UNAVAILABLE", message: "Injected outage" },
      }),
    });
  });

  await place(alicePage, "a1");
  const retry = alicePage
    .locator('.ptn.ply[data-ply-text="a1"] .send-failed')
    .first();
  await expect(retry).toBeVisible({ timeout: SYNC_TIMEOUT });
  expect(await serverPlies(alicePage)).toEqual([]);

  await retry.click();
  await expectMainline(bobPage, ["a1"]);
  await expectServer(alicePage, ["a1"]);
  await expect(alicePage.locator(".send-failed")).toHaveCount(0);
  await expect(unsent(alicePage, "a1")).toHaveCount(0, {
    timeout: SYNC_TIMEOUT,
  });
});

/**
 * With every local move sent, Undo has nothing to remove: the button asks for
 * a takeback instead
 */
async function expectNothingToUndo(page) {
  expect(
    await page.evaluate(() => window.app.$store.getters["online/lastUnsentPly"])
  ).toBe(null);
  await undoButton(page).hover();
  await expect(
    page.locator(".q-tooltip", { hasText: "Request Undo" })
  ).toBeVisible();
  await page.mouse.move(0, 0);
}

test("Undo removes only unsent plies", async ({ browser }) => {
  const { game, alicePage, bobPage } = await startGame(browser, {
    scratchboard: true,
  });
  await expect(undoButton(alicePage)).toBeDisabled();

  await place(alicePage, "a1");
  await expectServer(alicePage, ["a1"]);
  await play(bobPage, game, "e5");
  await expectMainline(alicePage, ["a1", "e5"]);
  await expectNothingToUndo(alicePage);

  await setSendMode(alicePage, "submit");
  await place(alicePage, "b1");
  await place(alicePage, "d4");
  await place(alicePage, "c1");
  await expectMainline(alicePage, ["a1", "e5", "b1", "d4", "c1"]);

  for (const remaining of [
    ["a1", "e5", "b1", "d4"],
    ["a1", "e5", "b1"],
    ["a1", "e5"],
  ]) {
    await undoButton(alicePage).click();
    await expectMainline(alicePage, remaining);
  }
  await expectNothingToUndo(alicePage);
  expect(await serverPlies(alicePage)).toEqual(["a1", "e5"]);
});

/** Make the page's next insertPly call fail in transit */
async function failNextSend(page) {
  let failed = false;
  await page.route("**/insertPly", (route) => {
    if (failed) {
      return route.continue();
    }
    failed = true;
    return route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({
        error: { status: "UNAVAILABLE", message: "Injected outage" },
      }),
    });
  });
}

test("a failed status doesn't carry over to a different move", async ({
  browser,
}) => {
  const { alicePage } = await startGame(browser);
  await setSendMode(alicePage, "submit");
  await failNextSend(alicePage);

  await place(alicePage, "a1");
  await submitButton(alicePage).click();
  await expect(alicePage.locator(".send-failed").first()).toBeVisible({
    timeout: SYNC_TIMEOUT,
  });

  await undoButton(alicePage).click();
  await expectMainline(alicePage, []);
  await place(alicePage, "b1");
  await expectMainline(alicePage, ["b1"]);
  await expect(alicePage.locator(".send-failed")).toHaveCount(0);
  await expect(submitButton(alicePage)).toHaveClass(/can-send/);
  expect(await serverPlies(alicePage)).toEqual([]);
});

test("switching from Submit to Auto-send doesn't send a held move", async ({
  browser,
}) => {
  const { alicePage, bobPage } = await startGame(browser);
  await setSendMode(alicePage, "submit");
  await place(alicePage, "a1");
  await expectMainline(alicePage, ["a1"]);

  await setSendMode(alicePage, "auto");
  await alicePage.waitForTimeout(1000);
  expect(await serverPlies(alicePage)).toEqual([]);
  // The held move still waits for Send
  await expect(submitButton(alicePage)).toHaveClass(/can-send/);

  await submitButton(alicePage).click();
  await expectMainline(bobPage, ["a1"]);
});

test("a move left unsent across a reload is held for Submit", async ({
  browser,
}) => {
  const { game, alicePage, bobPage } = await startGame(browser);
  await setSendMode(alicePage, "submit");
  await place(alicePage, "a1");
  await setSendMode(alicePage, "auto");
  // Let the local game save
  await alicePage.waitForTimeout(1000);

  await alicePage.reload();
  await alicePage.waitForFunction(
    () => {
      const online = window.app && window.app.$store.state.online;
      return online && online.initialized && online.user;
    },
    null,
    { timeout: 30000 }
  );
  await openGame(alicePage, game);
  await expectMainline(alicePage, ["a1"]);
  expect(await sendMode(alicePage)).toBe("auto");
  await expect(submitButton(alicePage)).toHaveClass(/can-send/, {
    timeout: SYNC_TIMEOUT,
  });
  await alicePage.waitForTimeout(1000);
  expect(await serverPlies(alicePage)).toEqual([]);

  await submitButton(alicePage).click();
  await expectMainline(bobPage, ["a1"]);
});

test("plies inserted outside the board are gated and auto-sent", async ({
  browser,
}) => {
  const { game, alicePage, bobPage } = await startGame(browser);
  const insert = (ply) =>
    alicePage.evaluate(
      (ply) => window.app.$store.dispatch("game/INSERT_PLY", ply),
      ply
    );
  const insertPlies = (plies) =>
    alicePage.evaluate(
      (plies) => window.app.$store.dispatch("game/INSERT_PLIES", { plies }),
      plies
    );

  await insert("a1");
  await expectMainline(bobPage, ["a1"]);
  await expectServer(alicePage, ["a1"]);

  // Bob's turn
  await insert("e5");
  await insertPlies(["e5", "b1"]);
  expect(await mainline(alicePage)).toEqual(["a1"]);

  await play(bobPage, game, "e5");
  await expectMainline(alicePage, ["a1", "e5"]);
  // Away from the end of the server's main line
  await alicePage.evaluate(() => window.app.$store.dispatch("game/FIRST"));
  await insert("c3");
  expect(await mainline(alicePage)).toEqual(["a1", "e5"]);
  expect(await branchPlies(alicePage)).toEqual([]);
});

test("cycling the stone type of a held move in Auto-send doesn't send it", async ({
  browser,
}) => {
  const { game, alicePage, bobPage } = await startGame(browser);
  await place(alicePage, "a1");
  await expectServer(alicePage, ["a1"]);
  await play(bobPage, game, "e5");
  await expectMainline(alicePage, ["a1", "e5"]);

  // b1 is held: made in Submit mode, then switched to Auto-send
  await setSendMode(alicePage, "submit");
  await place(alicePage, "b1");
  await setSendMode(alicePage, "auto");

  await place(alicePage, "b1");
  await expectMainline(alicePage, ["a1", "e5", "Sb1"]);
  await place(alicePage, "b1");
  await expectMainline(alicePage, ["a1", "e5", "Cb1"]);
  await alicePage.waitForTimeout(1000);
  expect(await serverPlies(alicePage)).toEqual(["a1", "e5"]);
  await expect(submitButton(alicePage)).toHaveClass(/can-send/);

  await submitButton(alicePage).click();
  await expectMainline(bobPage, ["a1", "e5", "Cb1"]);
  await expectServer(alicePage, ["a1", "e5", "Cb1"]);
});

test("a move to a game the server can't find is removed", async ({
  browser,
}) => {
  const { alicePage } = await startGame(browser);
  await alicePage.route("**/insertPly", (route) =>
    route.fulfill({
      status: 404,
      contentType: "application/json",
      body: JSON.stringify({
        error: { status: "NOT_FOUND", message: "Game does not exist" },
      }),
    })
  );

  await place(alicePage, "a1");
  await expect(
    alicePage.locator(".q-notification", { hasText: "Game does not exist" })
  ).toBeVisible({ timeout: SYNC_TIMEOUT });
  await expectMainline(alicePage, []);
  await expect(alicePage.locator(".send-failed")).toHaveCount(0);
});
