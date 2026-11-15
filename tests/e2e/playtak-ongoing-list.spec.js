// @ts-check
const { test, expect } = require("@playwright/test");

/**
 * The list of ongoing PlayTak games must arrive whole.
 *
 * PlayTak sends every line as a message of its own, so the games already
 * under way come in one message each, a few milliseconds apart. The list used
 * to be answered on the first of them, which showed one game and left the
 * rest for the dialog's next refresh, six seconds later.
 */

// GameList Add <id> <p1> <rating> vs <p2> <rating> <size> <time> <inc>
//   <scaleInc> <komiHalf> <flats> <caps> <unrated> <tournament>
const gameLine = (id, player1, player2) =>
  `GameList Add ${id} ${player1} 1500 vs ${player2} 1600 6 600 10 0 0 30 1 0 0`;

const GAMES = [
  gameLine(101, "alice", "bob"),
  gameLine(102, "carol", "dave"),
  gameLine(103, "erin", "frank"),
];

/**
 * Stand in for playtak.com's websocket: after login, send each ongoing game
 * in a message of its own, `gapMs` apart.
 */
async function mockPlaytakServer(page, gapMs) {
  await page.routeWebSocket(
    (url) => String(url).includes("/ws"),
    (ws) => {
      ws.onMessage(async (message) => {
        if (!String(message).trim().startsWith("Login ")) {
          return;
        }
        ws.send("Welcome anon!");
        for (const line of GAMES) {
          await new Promise((resolve) => setTimeout(resolve, gapMs));
          ws.send(line);
        }
      });
    }
  );
}

const fetchOngoingIDs = (page) =>
  page.evaluate(async () => {
    const games = await window.app.$store.dispatch(
      "game/FETCH_PLAYTAK_ONGOING_GAMES"
    );
    return games.map((game) => game.id);
  });

test("lists every ongoing game on the first fetch", async ({ page }) => {
  await mockPlaytakServer(page, 20);
  await page.goto("/");
  await page.waitForFunction(() => window.app && window.app.$store, null, {
    timeout: 30000,
  });

  expect(await fetchOngoingIDs(page)).toEqual([103, 102, 101]);
});

test("a fetch made while the games are arriving waits for all of them", async ({
  page,
}) => {
  await mockPlaytakServer(page, 40);
  await page.goto("/");
  await page.waitForFunction(() => window.app && window.app.$store, null, {
    timeout: 30000,
  });

  const lists = await page.evaluate(async () => {
    const fetchIDs = async () =>
      (
        await window.app.$store.dispatch("game/FETCH_PLAYTAK_ONGOING_GAMES")
      ).map((game) => game.id);
    const first = fetchIDs();
    // Midway through the games, after the first has arrived
    await new Promise((resolve) => setTimeout(resolve, 100));
    return Promise.all([first, fetchIDs()]);
  });

  expect(lists).toEqual([
    [103, 102, 101],
    [103, 102, 101],
  ]);
});
