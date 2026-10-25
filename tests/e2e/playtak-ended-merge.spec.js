// @ts-check
const { test, expect } = require("@playwright/test");

/**
 * A spectated game that ends while the connection is down must be merged into
 * the game as it stands, not replace it.
 *
 * The reconnect finds PlayTak has no such live game ("Game does not exist"),
 * so the final PTN is fetched from the history API. Replacing the held game
 * with it used to discard the user's analysis (branches) and the recorded
 * clock notes, and the result landed as a separate step in the undo history.
 */

const GAME_ID = 12346;
const OBSERVE_LINE = `Observe ${GAME_ID} alice bob 6 600 10 0 30 1 0 0`;
const OPENING_MOVES = ["P A1", "P F6", "P B1", "P F5"];

const FINAL_PTN = `[Size "6"]
[Opening "swap"]
[Player1 "alice"]
[Player2 "bob"]
[Result "R-0"]

1. a1 f6
2. b1 f5
3. c1 e5
4. d1 d5
5. e1 R-0
`;

async function mockServer(page) {
  const state = { ended: false, sockets: [] };

  await page.routeWebSocket(
    (url) => String(url).includes("/ws"),
    (ws) => {
      state.sockets.push(ws);
      ws.onMessage((message) => {
        const text = String(message).trim();
        if (text.startsWith("Login ")) {
          ws.send("Welcome anon!");
        } else if (text.startsWith("Observe ")) {
          if (state.ended) {
            ws.send("Error:Game does not exist");
            return;
          }
          ws.send(OBSERVE_LINE);
          for (const move of OPENING_MOVES) {
            ws.send(`Game#${GAME_ID} ${move}`);
          }
        }
      });
    }
  );

  await page.route(`**/games-history/ptn/${GAME_ID}`, (route) =>
    route.fulfill({ status: 200, contentType: "text/plain", body: FINAL_PTN })
  );

  return state;
}

const waitForMainline = (page, count) =>
  page.waitForFunction(
    (n) =>
      window.app &&
      window.app.$game &&
      window.app.$game.plies.filter(
        (ply) => ply && !ply.branch && ply.text !== "--"
      ).length === n,
    count,
    { timeout: 30000 }
  );

const mainline = (page) =>
  page.evaluate(() =>
    window.app.$game.plies
      .filter((ply) => ply && !ply.branch && ply.text !== "--")
      .map((ply) => ply.text)
  );

test("merges a game that ended while disconnected, keeping analysis", async ({
  page,
}) => {
  test.setTimeout(90000);
  const server = await mockServer(page);
  await page.goto("/");
  await page.waitForFunction(() => window.app && window.app.$store, {
    timeout: 30000,
  });
  // The dev server reloads the page once after first paint; follow after it.
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(3000);
  await page.evaluate((id) => {
    window.app.$store.dispatch("game/FOLLOW_PLAYTAK_GAME", { id });
  }, GAME_ID);
  await waitForMainline(page, 4);

  // User analysis: a branch off the second ply, and a clock note.
  const analysis = await page.evaluate(async () => {
    const store = window.app.$store;
    const game = window.app.$game;
    const plyID = game.plies.find((ply) => !ply.branch).id;
    await store.dispatch("game/SET_PLAYTAK_CLOCK_NOTE", {
      plyID,
      player: 1,
      ms: 123000,
    });
    store.dispatch("game/GO_TO_PLY", { plyID, isDone: true });
    await store.dispatch("game/INSERT_PLY", "c3");
    return {
      branches: window.app.$game.plies.filter((ply) => ply.branch).length,
      comments: JSON.stringify(window.app.$game.comments),
    };
  });
  expect(analysis.branches).toBeGreaterThan(0);

  // The game ends while we are away; the next connection finds it gone.
  server.ended = true;
  server.sockets[server.sockets.length - 1].close();

  await waitForMainline(page, 9);

  const after = await page.evaluate(() => ({
    branches: window.app.$game.plies.filter((ply) => ply.branch).length,
    comments: JSON.stringify(window.app.$game.comments),
    result: window.app.$game.tag("result"),
    live: window.app.$store.state.game.config.playtakLive,
  }));
  expect(after.branches).toBe(analysis.branches);
  expect(after.comments).toBe(analysis.comments);
  expect(after.result).toBe("R-0");
  expect(after.live).toBe(false);
});
