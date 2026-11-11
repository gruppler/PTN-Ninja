// @ts-check
const { test, expect } = require("@playwright/test");
const { createAccount, signIn, signInAsGuest } = require("./helpers");

const SYNC_TIMEOUT = 5000;

// Each test takes several round trips through the callables
test.setTimeout(90000);

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
      .filter((ply) => ply && !ply.branch && ply.text !== "--")
      .map((ply) => ply.text)
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

const getter = (page, name) =>
  page.evaluate((name) => window.app.$store.getters[`online/${name}`], name);

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

/** Both boards and the server have this main line */
const expectLine = async (pages, plies) => {
  for (const page of pages) {
    await expect
      .poll(() => serverPlies(page), { timeout: SYNC_TIMEOUT })
      .toEqual(plies);
    await expect
      .poll(() => mainline(page), { timeout: SYNC_TIMEOUT })
      .toEqual(plies);
    expect(
      await page.evaluate(
        () => window.app.$store.state.game.config.syncedMainline
      )
    ).toBe(plies.length);
    expect(await getter(page, "currentState")).toMatchObject({
      plyIndex: plies.length,
    });
  }
};

/** The local game's undo history: its position and length */
const history = (page) =>
  page.evaluate(() => [
    window.app.$game.historyIndex,
    window.app.$game.history.length,
  ]);

const undoButton = (page) => page.locator(".gameplay-controls .undo-button");
const drawButton = (page) => page.locator(".gameplay-controls .draw-button");
/** My own pending request's button, lit until it's answered or withdrawn */
const myRequest = (page) => page.locator(".gameplay-controls .request-pending");
/** The button holding the opponent's request, which opens its menu */
const theirRequest = (page) =>
  page.locator(".gameplay-controls .opponent-request");
const requestMenu = (page) => page.locator(".request-menu");

/** Answer the opponent's request from its button's menu */
const answer = async (page, action) => {
  await theirRequest(page).click();
  await page.locator(`.request-menu .${action}-request`).click();
  await expect(requestMenu(page)).toHaveCount(0);
};
const accept = (page) => answer(page, "accept");
const decline = (page) => answer(page, "decline");

/** The page's pending request, as { type, player } */
const pending = (page) =>
  page.evaluate(() => {
    const request = window.app.$store.getters["online/pendingRequest"];
    return request ? { type: request.type, player: request.player } : null;
  });

/**
 * Both players see the request on its button: the opponent's opens Accept
 * and Decline, with no dialog
 */
const expectRequest = async (requester, opponent, request, text) => {
  for (const page of [requester, opponent]) {
    await expect
      .poll(() => pending(page), { timeout: SYNC_TIMEOUT })
      .toEqual(request);
  }
  const button = `.${request.type === "draw" ? "draw" : "undo"}-button`;
  await expect(theirRequest(opponent)).toHaveCount(1);
  await expect(opponent.locator(`${button}.opponent-request`)).toBeEnabled();
  await expect(myRequest(opponent)).toHaveCount(0);
  await expect(opponent.locator(".q-dialog")).toHaveCount(0);
  await theirRequest(opponent).click();
  await expect(requestMenu(opponent)).toContainText(text);
  await expect(opponent.locator(".request-menu .accept-request")).toBeVisible();
  await expect(
    opponent.locator(".request-menu .decline-request")
  ).toBeVisible();
  // Its button closes it again
  await theirRequest(opponent).click();
  await expect(requestMenu(opponent)).toHaveCount(0);
  // The requester can only withdraw it
  await expect(myRequest(requester)).toHaveCount(1);
  await expect(requester.locator(`${button}.request-pending`)).toBeEnabled();
  await expect(theirRequest(requester)).toHaveCount(0);
};

const expectNoRequest = async (pages) => {
  for (const page of pages) {
    await expect
      .poll(() => pending(page), { timeout: SYNC_TIMEOUT })
      .toBe(null);
    await expect(myRequest(page)).toHaveCount(0);
    await expect(theirRequest(page)).toHaveCount(0);
  }
};

/**
 * Alice (player 1) and Bob (player 2) in a public 5x5 game, both with it
 * open
 */
async function startGame(browser) {
  const names = [uniqueName("Alice"), uniqueName("Bob")];
  const [alice, bob] = await Promise.all(names.map(createAccount));
  const alicePage = await (await browser.newContext()).newPage();
  const bobPage = await (await browser.newContext()).newPage();
  await Promise.all([signIn(alicePage, alice), signIn(bobPage, bob)]);

  const game = await callFunction(alicePage, "createGame", {
    config: { isPrivate: false, playerSeat: 1 },
    tags: { size: 5, komi: 0, opening: "swap" },
    tps: "x5/x5/x5/x5/x5 1 1",
  });
  await openGame(alicePage, game);
  await openGame(bobPage, game);
  await callFunction(bobPage, "joinGame", game);
  for (const page of [alicePage, bobPage]) {
    await page.waitForFunction(
      () => window.app.$store.getters["online/hasOpponent"],
      null,
      { timeout: SYNC_TIMEOUT }
    );
  }
  return { game, alicePage, bobPage, names };
}

const expectDrawn = async (pages) => {
  for (const page of pages) {
    await page.waitForFunction(
      () => window.app.$store.getters["online/hasEnded"],
      null,
      { timeout: SYNC_TIMEOUT }
    );
    await expect(page.locator(".gameplay-controls")).toHaveCount(0);
    await expect(page.locator(".ptn.result").first()).toHaveText("½½", {
      timeout: SYNC_TIMEOUT,
    });
    expect(await page.evaluate(() => window.app.$game.tag("result"))).toBe(
      "1/2-1/2"
    );
    expect(await getter(page, "result")).toBe("1/2-1/2");
  }
};

/** No further move is accepted on either board, nor by the server */
const expectNoMoves = async (pages, game) => {
  const before = await Promise.all(pages.map(mainline));
  for (const page of pages) {
    await place(page, "c3");
    await place(page, "d3");
  }
  await pages[0].waitForTimeout(500);
  expect(await Promise.all(pages.map(mainline))).toEqual(before);
  for (const page of pages) {
    const error = await page.evaluate(
      ({ game, plyIndex }) =>
        window.functions
          .httpsCallable("insertPly")({ ...game, ply: "c3", plyIndex })
          .then(
            () => null,
            (error) => error.code
          ),
      { game, plyIndex: before[0].length }
    );
    expect(error).toBe("failed-precondition");
  }
};

test("a declined draw offer leaves the game going; an accepted one ends it 1/2-1/2", async ({
  browser,
}) => {
  const { game, alicePage, bobPage, names } = await startGame(browser);
  await play(alicePage, game, "a1");
  await expectLine([alicePage, bobPage], ["a1"]);

  // Alice offers on Bob's turn; Bob declines
  await expect(drawButton(alicePage)).toBeEnabled();
  await drawButton(alicePage).click();
  await expectRequest(
    alicePage,
    bobPage,
    { type: "draw", player: 1 },
    `${names[0]} offers a draw`
  );
  // One request at a time: Bob's Draw button answers Alice's
  await expect(drawButton(bobPage)).toHaveClass(/opponent-request/);
  await decline(bobPage);
  await expectNoRequest([alicePage, bobPage]);
  expect(await getter(alicePage, "hasEnded")).toBe(false);
  await expect(alicePage.locator(".gameplay-controls")).toBeVisible();

  // The game goes on
  await play(bobPage, game, "e5");
  await expectLine([alicePage, bobPage], ["a1", "e5"]);

  // Bob offers on Alice's turn; Alice accepts
  await drawButton(bobPage).click();
  await expectRequest(
    bobPage,
    alicePage,
    { type: "draw", player: 2 },
    `${names[1]} offers a draw`
  );
  await accept(alicePage);
  await expectDrawn([alicePage, bobPage]);
  await expectLine([alicePage, bobPage], ["a1", "e5"]);
  await expectNoMoves([alicePage, bobPage], game);
});

test("a one-ply takeback: declined, then accepted, and both boards follow", async ({
  browser,
}) => {
  const { game, alicePage, bobPage, names } = await startGame(browser);
  // Nothing to take back yet
  await expect(undoButton(alicePage)).toBeDisabled();
  await expect(undoButton(bobPage)).toBeDisabled();

  await play(alicePage, game, "a1");
  await expectLine([alicePage, bobPage], ["a1"]);
  // Bob has no move on the main line
  await expect(undoButton(bobPage)).toBeDisabled();
  expect(await getter(bobPage, "takebackCount")).toBe(0);
  expect(await getter(alicePage, "takebackCount")).toBe(1);

  await undoButton(alicePage).click();
  await expectRequest(
    alicePage,
    bobPage,
    { type: "takeback", player: 1 },
    `${names[0]} asks to undo their move`
  );
  await decline(bobPage);
  await expectNoRequest([alicePage, bobPage]);
  await expectLine([alicePage, bobPage], ["a1"]);

  await undoButton(alicePage).click();
  await expectRequest(
    alicePage,
    bobPage,
    { type: "takeback", player: 1 },
    `${names[0]} asks to undo their move`
  );
  const historyBefore = await Promise.all([alicePage, bobPage].map(history));
  await accept(bobPage);
  await expectNoRequest([alicePage, bobPage]);
  await expectLine([alicePage, bobPage], []);
  // It's Alice's turn again, and the removal isn't hers to undo or redo
  expect(await getter(alicePage, "isMyTurn")).toBe(true);
  expect(await getter(bobPage, "isMyTurn")).toBe(false);
  expect(await Promise.all([alicePage, bobPage].map(history))).toEqual(
    historyBefore
  );

  // She plays something else, from the board
  await place(alicePage, "b2");
  await expectLine([alicePage, bobPage], ["b2"]);
  await play(bobPage, game, "e5");
  await expectLine([alicePage, bobPage], ["b2", "e5"]);
});

test("a two-ply takeback: declined, then accepted, and both boards follow", async ({
  browser,
}) => {
  const { game, alicePage, bobPage, names } = await startGame(browser);
  await play(alicePage, game, "a1");
  await play(bobPage, game, "e5");
  await play(alicePage, game, "c3");
  await play(bobPage, game, "d3");
  const line = ["a1", "e5", "c3", "d3"];
  await expectLine([alicePage, bobPage], line);
  expect(await getter(alicePage, "takebackCount")).toBe(2);
  expect(await getter(bobPage, "takebackCount")).toBe(1);

  // Alice asks on her own turn: her move and Bob's reply would go
  await undoButton(alicePage).click();
  await expectRequest(
    alicePage,
    bobPage,
    { type: "takeback", player: 1 },
    `${names[0]} asks to undo their move`
  );
  await decline(bobPage);
  await expectNoRequest([alicePage, bobPage]);
  await expectLine([alicePage, bobPage], line);

  await undoButton(alicePage).click();
  await expect(theirRequest(bobPage)).toBeVisible({ timeout: SYNC_TIMEOUT });
  await accept(bobPage);
  await expectNoRequest([alicePage, bobPage]);
  await expectLine([alicePage, bobPage], ["a1", "e5"]);
  expect(await getter(alicePage, "isMyTurn")).toBe(true);
  // The boards show the position without the removed stones
  for (const page of [alicePage, bobPage]) {
    expect(await getter(page, "currentState")).toMatchObject({
      tps: "x4,1/x5/x5/x5/2,x4 1 2",
    });
    await page.evaluate(() => window.app.$store.dispatch("game/LAST"));
    expect(
      await page.evaluate(() => window.app.$store.state.game.position.tps)
    ).toBe("x4,1/x5/x5/x5/2,x4 1 2");
  }

  await place(alicePage, "b2");
  await expectLine([alicePage, bobPage], ["a1", "e5", "b2"]);
});

test("a request is withdrawn with its button, and spectators have no part in it", async ({
  browser,
}) => {
  const { game, alicePage, bobPage } = await startGame(browser);
  await play(alicePage, game, "a1");
  await expectLine([alicePage, bobPage], ["a1"]);

  const guestPage = await (await browser.newContext()).newPage();
  await signInAsGuest(guestPage);
  await openGame(guestPage, game);
  await expect
    .poll(() => mainline(guestPage), { timeout: SYNC_TIMEOUT })
    .toEqual(["a1"]);
  await expect(drawButton(guestPage)).toHaveCount(0);

  // A draw offer, withdrawn with the Draw button
  await drawButton(alicePage).click();
  await expect(theirRequest(bobPage)).toBeVisible({ timeout: SYNC_TIMEOUT });
  await expect(drawButton(alicePage)).toHaveClass(/request-pending/);
  await expect
    .poll(() => pending(guestPage), { timeout: SYNC_TIMEOUT })
    .toEqual({ type: "draw", player: 1 });
  await expect(guestPage.locator(".request-menu")).toHaveCount(0);
  // The spectator can't answer it
  expect(
    await guestPage.evaluate(
      (game) =>
        window.functions
          .httpsCallable("acceptRequest")(game)
          .then(
            () => null,
            (error) => error.code
          ),
      game
    )
  ).toBe("permission-denied");
  await drawButton(alicePage).click();
  await expectNoRequest([alicePage, bobPage, guestPage]);
  await expect(drawButton(alicePage)).not.toHaveClass(/request-pending/);

  // A takeback request, withdrawn with the Undo button
  await undoButton(alicePage).click();
  await expect(theirRequest(bobPage)).toBeVisible({ timeout: SYNC_TIMEOUT });
  await expect(undoButton(alicePage)).toHaveClass(/request-pending/);
  await expect(undoButton(bobPage)).toHaveClass(/opponent-request/);
  await undoButton(alicePage).click();
  await expectNoRequest([alicePage, bobPage]);
  await expectLine([alicePage, bobPage], ["a1"]);
  expect(await getter(alicePage, "hasEnded")).toBe(false);
});

test("a move clears a pending request", async ({ browser }) => {
  const { game, alicePage, bobPage } = await startGame(browser);
  await play(alicePage, game, "a1");
  await expectLine([alicePage, bobPage], ["a1"]);

  // Bob answers Alice's takeback request by moving, from the board
  await undoButton(alicePage).click();
  await expect(theirRequest(bobPage)).toBeVisible({ timeout: SYNC_TIMEOUT });
  await place(bobPage, "e5");
  await expectLine([alicePage, bobPage], ["a1", "e5"]);
  await expectNoRequest([alicePage, bobPage]);

  // Alice's own move clears her draw offer
  await drawButton(alicePage).click();
  await expect(theirRequest(bobPage)).toBeVisible({ timeout: SYNC_TIMEOUT });
  await place(alicePage, "c3");
  await expectLine([alicePage, bobPage], ["a1", "e5", "c3"]);
  await expectNoRequest([alicePage, bobPage]);
  expect(await getter(alicePage, "hasEnded")).toBe(false);
});

test("an accepted takeback also removes an unsent move made on top of it", async ({
  browser,
}) => {
  const { game, alicePage, bobPage } = await startGame(browser);
  await play(alicePage, game, "a1");
  await expectLine([alicePage, bobPage], ["a1"]);

  // Bob holds a reply in Submit mode
  await bobPage
    .locator(".gameplay-controls .submit-button")
    .click({ button: "right" });
  expect(
    await bobPage.evaluate(() => window.app.$store.state.ui.onlineSendMode)
  ).toBe("submit");
  await place(bobPage, "e5");
  await expect
    .poll(() => mainline(bobPage), { timeout: SYNC_TIMEOUT })
    .toEqual(["a1", "e5"]);
  // He has no sent move to take back
  expect(await getter(bobPage, "takebackCount")).toBe(0);

  await undoButton(alicePage).click();
  await expect(theirRequest(bobPage)).toBeVisible({ timeout: SYNC_TIMEOUT });
  await accept(bobPage);
  await expectNoRequest([alicePage, bobPage]);
  await expectLine([alicePage, bobPage], []);
  expect(await getter(bobPage, "unsentPly")).toBe(null);
  await expect(
    bobPage.locator(".q-notification.bg-negative, .q-notification.bg-red")
  ).toHaveCount(0);

  await place(alicePage, "b2");
  await expectLine([alicePage, bobPage], ["b2"]);
});

test("a spectator's line that branches off at the removed move stays", async ({
  browser,
}) => {
  const { game, alicePage, bobPage } = await startGame(browser);
  await play(alicePage, game, "a1");
  await play(bobPage, game, "e5");
  await play(alicePage, game, "c3");
  await expectLine([alicePage, bobPage], ["a1", "e5", "c3"]);

  const guestPage = await (await browser.newContext()).newPage();
  await signInAsGuest(guestPage);
  await openGame(guestPage, game);
  await expect
    .poll(() => mainline(guestPage), { timeout: SYNC_TIMEOUT })
    .toEqual(["a1", "e5", "c3"]);

  // The spectator tries another move in place of c3
  await guestPage.evaluate(async () => {
    const store = window.app.$store;
    await store.dispatch("game/PREV", { half: false, times: 1 });
    await store.dispatch("game/INSERT_PLY", "d4");
  });
  const branches = () =>
    guestPage.evaluate(() =>
      window.app.$game.plies
        .filter((ply) => ply && ply.branch)
        .map((ply) => ply.text)
    );
  expect(await mainline(guestPage)).toEqual(["a1", "e5", "c3"]);
  expect(await branches()).toEqual(["d4"]);
  const synced = () =>
    guestPage.evaluate(
      () => window.app.$store.state.game.config.syncedMainline
    );

  await undoButton(alicePage).click();
  await expect(theirRequest(bobPage)).toBeVisible({ timeout: SYNC_TIMEOUT });
  await accept(bobPage);
  await expectLine([alicePage, bobPage], ["a1", "e5"]);
  await expect
    .poll(() => serverPlies(guestPage), { timeout: SYNC_TIMEOUT })
    .toEqual(["a1", "e5"]);
  // c3 is gone, and the line that replaced it is not part of the game
  await expect
    .poll(() => mainline(guestPage), { timeout: SYNC_TIMEOUT })
    .toEqual(["a1", "e5", "d4"]);
  expect(await branches()).toEqual([]);
  expect(await synced()).toBe(2);
  await expect(
    guestPage.locator(".q-notification.bg-negative, .q-notification.bg-red")
  ).toHaveCount(0);

  // The game's next move takes the main line; the spectator's line stays
  await play(alicePage, game, "b2");
  await expect
    .poll(() => mainline(guestPage), { timeout: SYNC_TIMEOUT })
    .toEqual(["a1", "e5", "b2"]);
  expect(await synced()).toBe(3);
  expect(await branches()).toEqual(["d4"]);
});
