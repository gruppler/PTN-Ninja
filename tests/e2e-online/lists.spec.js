// @ts-check
const { test, expect } = require("@playwright/test");
const { createAccount, signIn } = require("./helpers");

test.describe.configure({ timeout: 60000 });

const TIMEOUT = 15000;

let counter = 0;
const uniqueName = (prefix) =>
  `${prefix}${Date.now().toString(36)}${counter++}`;

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
    tps: "x5/x5/x5/x5/x5 1 1",
  });
}

async function newPage(browser, account) {
  const context = await browser.newContext();
  const page = await context.newPage();
  await signIn(page, account);
  return page;
}

/** Open the online games dialog (no filter in the route) */
async function openDialog(page) {
  await page.evaluate(() => {
    window.app.$router.push({ name: "load-online" });
  });
  await expect(page.locator(".game-table")).toBeVisible();
}

const filterParam = (page) =>
  page.evaluate(() => window.app.$route.params.filter);

/** The ids of the games in the table, in order */
const rowIDs = (page) =>
  page.evaluate(() => {
    const table = document.querySelector(".game-table").__vue__;
    return table.data.map((game) => game.config.id);
  });

async function selectFilter(page, label) {
  await page
    .locator(".game-table .q-btn-group .q-btn", { hasText: label })
    .click();
}

test("Mine lists my games ongoing first, and finished games move to Recent", async ({
  browser,
}) => {
  const [alice, bob] = await Promise.all([
    createAccount(uniqueName("Alice")),
    createAccount(uniqueName("Bob")),
  ]);
  const alicePage = await newPage(browser, alice);
  const bobPage = await newPage(browser, bob);

  // First game: public, joined by Bob and played, then finished
  const first = await createGame(alicePage, { isPrivate: false });
  await callFunction(bobPage, "joinGame", first);
  await callFunction(alicePage, "insertPly", {
    ...first,
    ply: "a1",
    plyIndex: 0,
  });
  // Second game: private, joined by Bob, still ongoing, created later
  const second = await createGame(alicePage, { isPrivate: true });
  await callFunction(bobPage, "joinGame", second);
  await callFunction(alicePage, "resign", first);

  for (const page of [alicePage, bobPage]) {
    await openDialog(page);
    await expect
      .poll(() => filterParam(page), { timeout: TIMEOUT })
      .toBe("mine");
    await expect
      .poll(
        async () =>
          (
            await rowIDs(page)
          ).filter((id) => [first.id, second.id].includes(id)),
        {
          timeout: TIMEOUT,
        }
      )
      // Ongoing first, then the finished one
      .toEqual([second.id, first.id]);

    await selectFilter(page, "Ongoing");
    await expect
      .poll(() => rowIDs(page), { timeout: TIMEOUT })
      .not.toContain(first.id);
    await selectFilter(page, "Recent");
    await expect
      .poll(() => rowIDs(page), { timeout: TIMEOUT })
      .toContain(first.id);
  }

  // The private game is Mine only: it is in no other list
  await selectFilter(alicePage, "Recent");
  expect(await rowIDs(alicePage)).not.toContain(second.id);
});

test("an ongoing public game is listed under Ongoing until it ends", async ({
  browser,
}) => {
  const [alice, bob, carol] = await Promise.all([
    createAccount(uniqueName("Alice")),
    createAccount(uniqueName("Bob")),
    createAccount(uniqueName("Carol")),
  ]);
  const alicePage = await newPage(browser, alice);
  const bobPage = await newPage(browser, bob);
  const carolPage = await newPage(browser, carol);

  const game = await createGame(alicePage, { isPrivate: false });
  await callFunction(bobPage, "joinGame", game);

  await openDialog(carolPage);
  await expect.poll(() => filterParam(carolPage)).toBe("open");
  await selectFilter(carolPage, "Ongoing");
  await expect
    .poll(() => rowIDs(carolPage), { timeout: TIMEOUT })
    .toContain(game.id);

  await callFunction(alicePage, "resign", game);
  await expect
    .poll(() => rowIDs(carolPage), { timeout: TIMEOUT })
    .not.toContain(game.id);
  await selectFilter(carolPage, "Recent");
  await expect
    .poll(() => rowIDs(carolPage), { timeout: TIMEOUT })
    .toContain(game.id);
});

test("an open game is listed under Open and not under Mine for others", async ({
  browser,
}) => {
  const [alice, bob] = await Promise.all([
    createAccount(uniqueName("Alice")),
    createAccount(uniqueName("Bob")),
  ]);
  const alicePage = await newPage(browser, alice);
  const bobPage = await newPage(browser, bob);
  const game = await createGame(alicePage, { isPrivate: false });

  await openDialog(bobPage);
  await expect.poll(() => filterParam(bobPage)).toBe("open");
  await expect
    .poll(() => rowIDs(bobPage), { timeout: TIMEOUT })
    .toContain(game.id);
  await selectFilter(bobPage, "Mine");
  expect(await rowIDs(bobPage)).not.toContain(game.id);

  // Alice sees it under Mine
  await openDialog(alicePage);
  await expect.poll(() => filterParam(alicePage)).toBe("mine");
  await expect
    .poll(() => rowIDs(alicePage), { timeout: TIMEOUT })
    .toContain(game.id);
});

test("reopening the dialog drops games that left a list while it was closed", async ({
  browser,
}) => {
  const [alice, bob, carol] = await Promise.all([
    createAccount(uniqueName("Alice")),
    createAccount(uniqueName("Bob")),
    createAccount(uniqueName("Carol")),
  ]);
  const alicePage = await newPage(browser, alice);
  const bobPage = await newPage(browser, bob);
  const carolPage = await newPage(browser, carol);

  const openGame = await createGame(alicePage, { isPrivate: false });
  const playing = await createGame(alicePage, { isPrivate: false });
  await callFunction(bobPage, "joinGame", playing);

  await openDialog(carolPage);
  await expect
    .poll(() => rowIDs(carolPage), { timeout: TIMEOUT })
    .toContain(openGame.id);
  await selectFilter(carolPage, "Ongoing");
  await expect
    .poll(() => rowIDs(carolPage), { timeout: TIMEOUT })
    .toContain(playing.id);

  // Close the dialog; meanwhile one game is joined and the other ends
  await carolPage.evaluate(() => {
    window.app.$router.push({ path: "/" });
  });
  await expect(carolPage.locator(".game-table")).toBeHidden();
  await callFunction(bobPage, "joinGame", openGame);
  await callFunction(alicePage, "resign", playing);

  await openDialog(carolPage);
  await selectFilter(carolPage, "Ongoing");
  await expect
    .poll(() => rowIDs(carolPage), { timeout: TIMEOUT })
    .toContain(openGame.id);
  expect(await rowIDs(carolPage)).not.toContain(playing.id);
  await selectFilter(carolPage, "Open");
  expect(await rowIDs(carolPage)).not.toContain(openGame.id);

  // The same goes for Mine
  await openDialog(alicePage);
  await selectFilter(alicePage, "Mine");
  await expect
    .poll(() => rowIDs(alicePage), { timeout: TIMEOUT })
    .toContain(playing.id);
});
