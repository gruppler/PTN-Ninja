// @ts-check
const { test, expect } = require("@playwright/test");

/**
 * A PlayTak undo while following a live game.
 *
 * Two things went wrong:
 *
 * - The undone ply was taken to be the last main-line ply. With scratch
 *   moves after the live position that is a scratch move, so the wrong ply
 *   was deleted and the synced count dropped anyway, leaving the board out
 *   of step with the server (white's moves read as black's).
 * - The move replayed after an undo is often the one that was undone, and
 *   the duplicate filter dropped it.
 */

const GAME_ID = 12346;
const OBSERVE_LINE = `Observe ${GAME_ID} alice bob 6 600 10 0 30 1 0 0`;
const OPENING_MOVES = ["P A1", "P F6", "P B1", "P F5"];

async function mockPlaytakServer(page, moves) {
  const sockets = [];
  const state = { moves: [...moves] };

  await page.routeWebSocket(
    (url) => /playtak\.com\/ws$/.test(String(url)),
    (ws) => {
      sockets.push(ws);
      ws.onMessage((message) => {
        const text = String(message).trim();
        if (text.startsWith("Login ")) {
          ws.send("Welcome anon!");
        } else if (text.startsWith("Observe ")) {
          ws.send(OBSERVE_LINE);
          for (const move of state.moves) {
            ws.send(`Game#${GAME_ID} ${move}`);
          }
        }
      });
    }
  );

  const send = (line) => sockets[sockets.length - 1].send(line);
  return {
    play(move) {
      state.moves.push(move);
      send(`Game#${GAME_ID} ${move}`);
    },
    undo() {
      state.moves.pop();
      send(`Game#${GAME_ID} Undo`);
    },
  };
}

const mainline = (page) =>
  page.evaluate(() =>
    window.app.$game.plies
      .filter((ply) => ply && !ply.branch && ply.text !== "--")
      .map((ply) => ply.text)
  );

const synced = (page) =>
  page.evaluate(() => window.app.$game.config.playtakSyncedMainline);

async function startFollowing(page) {
  await page.goto("/");
  // Wait for startup to add and switch to its first game: a switch that
  // lands after FOLLOW_PLAYTAK_GAME would stop the follow
  await page.waitForFunction(
    () =>
      window.app &&
      window.app.$store &&
      window.app.$store.state.game.list.length > 0,
    null,
    {
      timeout: 30000,
    }
  );
  await page.evaluate((id) => {
    window.app.$store.dispatch("game/FOLLOW_PLAYTAK_GAME", { id });
  }, GAME_ID);
  await expect
    .poll(() => mainline(page), { timeout: 15000 })
    .toHaveLength(OPENING_MOVES.length);
}

test.describe("PlayTak undo", () => {
  test("replaying the undone move is not dropped", async ({ page }) => {
    const server = await mockPlaytakServer(page, OPENING_MOVES);
    await startFollowing(page);

    server.play("P C1");
    await expect.poll(() => mainline(page)).toHaveLength(5);

    server.undo();
    await expect.poll(() => mainline(page)).toHaveLength(4);
    expect(await synced(page)).toBe(4);

    server.play("P C1");
    await expect.poll(() => mainline(page)).toHaveLength(5);
    expect(await synced(page)).toBe(5);
  });

  test("scratch moves survive an undo and the synced count stays true", async ({
    page,
  }) => {
    const server = await mockPlaytakServer(page, OPENING_MOVES);
    await startFollowing(page);

    server.play("P C1");
    await expect.poll(() => mainline(page)).toHaveLength(5);

    // Scratch moves after the live position
    for (const ply of ["D1", "E1"]) {
      await page.evaluate(
        (ply) => window.app.$store.dispatch("game/INSERT_PLY", ply),
        ply
      );
    }
    expect(await mainline(page)).toHaveLength(7);

    server.undo();
    await expect.poll(() => synced(page)).toBe(4);
    // None of the user's scratch moves are lost
    expect(await mainline(page)).toHaveLength(7);

    // A different move than the one undone
    server.play("P D1");
    await expect.poll(() => synced(page)).toBe(5);
    const live = (await mainline(page)).slice(0, 5);
    expect(live[4]).toMatch(/d1/i);
    const state = await page.evaluate(() => window.app.$game.config);
    expect(state.playtakLive).toBe(true);
  });

  test("scratch moves are marked unsynced until they are played", async ({
    page,
  }) => {
    const server = await mockPlaytakServer(page, OPENING_MOVES);
    await startFollowing(page);

    await page.evaluate(() =>
      window.app.$store.dispatch("game/INSERT_PLY", "C1")
    );
    await page.evaluate(() =>
      window.app.$store.dispatch("game/INSERT_PLY", "D1")
    );

    // A ply can be rendered in more than one place
    const unsynced = () =>
      page.evaluate(() => [
        ...new Set(
          [...document.querySelectorAll(".ptn.ply.unsynced")].map(
            (el) => el.dataset.plyText
          )
        ),
      ]);
    await expect.poll(unsynced).toEqual(["c1", "d1"]);

    server.play("P C1");
    await expect.poll(unsynced).toEqual(["d1"]);
  });
});
