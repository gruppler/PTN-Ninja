// @ts-check
const { test, expect } = require("@playwright/test");

/**
 * Losing the PlayTak connection mid-game must not silently end the stream.
 *
 * A dropped socket used to be the quietest failure in the app: the session
 * was gone, but `playtakLive` stayed set, so the board still presented
 * itself as live and the clock kept counting down off the last update it
 * saw. The PlayTak icon stayed lit too, since it reports `follow ||
 * ongoing` and the ongoing-games feed is a separate socket. Moves simply
 * stopped, and only a reload revealed it.
 *
 * The session now re-observes instead. The server re-sends the game from
 * the start and the replay guard in the M/P handler walks that history
 * against the plies already held, appending only from the point they
 * diverge — so the recovery merges rather than duplicating.
 */

const GAME_ID = 12345;

// Observe <id> <p1> <p2> <size> <time> <inc> <komiHalf> <flats> <caps>
//         <unrated> <tournament>
const OBSERVE_LINE = `Observe ${GAME_ID} alice bob 6 600 10 0 30 1 0 0`;

const OPENING_MOVES = ["P A1", "P F6", "P B1", "P F5"];

/**
 * Stand in for playtak.com's websocket.
 *
 * Replays `moves` to every connection that observes, which is what makes
 * the client's merge path run on a reconnect. Returns handles for pushing
 * live moves and for dropping the socket the way a server-side failure
 * would.
 */
async function mockPlaytakServer(page, moves) {
  const sockets = [];
  // `silentObserves` connections ignore Observe, the way a connection that
  // never gets through looks from the client
  const state = {
    connections: 0,
    observes: 0,
    silentObserves: 0,
    moves: [...moves],
  };

  await page.routeWebSocket(
    (url) => String(url).includes("/ws"),
    (ws) => {
      state.connections += 1;
      sockets.push(ws);

      ws.onMessage((message) => {
        const text = String(message).trim();

        if (text.startsWith("Login ")) {
          ws.send("Welcome anon!");
          return;
        }

        if (text.startsWith("Observe ")) {
          if (state.silentObserves > 0) {
            state.silentObserves -= 1;
            return;
          }
          state.observes += 1;
          ws.send(OBSERVE_LINE);
          // The full history, every time — this is what a re-observe gets,
          // and what the replay guard has to merge against.
          for (const move of state.moves) {
            ws.send(`Game#${GAME_ID} ${move}`);
          }
        }
      });
    }
  );

  return {
    state,
    /** Broadcast a live move and remember it for later observers. */
    play(move) {
      state.moves.push(move);
      const socket = sockets[sockets.length - 1];
      socket.send(`Game#${GAME_ID} ${move}`);
    },
    /** Drop the current connection without the client asking. */
    drop() {
      sockets[sockets.length - 1].close();
    },
  };
}

const mainlineCount = (page) =>
  page.evaluate(() => {
    const game = window.app && window.app.$game;
    if (!game || !game.plies) return 0;
    return game.plies.filter((ply) => ply && !ply.branch && ply.text !== "--")
      .length;
  });

async function expectMainlineCount(page, expected) {
  await page.waitForFunction(
    (count) => {
      const game = window.app && window.app.$game;
      if (!game || !game.plies) return false;
      return (
        game.plies.filter((ply) => ply && !ply.branch && ply.text !== "--")
          .length === count
      );
    },
    expected,
    { timeout: 15000 }
  );
}

/**
 * Start following, and wait for the opening burst to commit.
 *
 * The dispatch is deliberately not awaited in the page: following a game
 * navigates, which destroys the evaluate's execution context before the
 * returned promise can settle.
 */
async function startFollowing(page) {
  await page.goto("/");
  await page.waitForFunction(() => window.app && window.app.$store, {
    timeout: 30000,
  });

  await page.evaluate((id) => {
    window.app.$store.dispatch("game/FOLLOW_PLAYTAK_GAME", { id });
  }, GAME_ID);

  await expectMainlineCount(page, OPENING_MOVES.length);
}

test.describe("PlayTak spectate resync", () => {
  test("re-observes and merges after the socket drops", async ({ page }) => {
    const server = await mockPlaytakServer(page, OPENING_MOVES);
    await startFollowing(page);

    server.play("P C1");
    await expectMainlineCount(page, OPENING_MOVES.length + 1);
    expect(server.state.connections).toBe(1);

    // The failure: gone, with nobody having asked to stop.
    server.drop();

    await expect
      .poll(() => server.state.observes, { timeout: 20000 })
      .toBeGreaterThan(1);

    // The merge must not re-append the history it already holds.
    await expect
      .poll(() => mainlineCount(page), { timeout: 20000 })
      .toBe(OPENING_MOVES.length + 1);

    // And live moves flow again on the new connection.
    server.play("P D1");
    await expectMainlineCount(page, OPENING_MOVES.length + 2);

    expect(server.state.connections).toBe(2);
  });

  test("keeps recovering from repeated drops", async ({ page }) => {
    const server = await mockPlaytakServer(page, OPENING_MOVES);
    await startFollowing(page);

    // Four drops is past any fixed retry budget. Each recovery lands a live
    // ply, which resets the backoff — the case that matters for a spectator
    // on a flaky connection, who should never be asked to reload.
    const followUps = ["P C1", "P D1", "P E1", "P C2"];
    for (let i = 0; i < followUps.length; i++) {
      const before = server.state.connections;
      server.drop();

      await expect
        .poll(() => server.state.connections, { timeout: 20000 })
        .toBe(before + 1);

      server.play(followUps[i]);
      await expectMainlineCount(page, OPENING_MOVES.length + i + 1);
    }

    expect(server.state.connections).toBe(followUps.length + 1);
  });

  // A phone back from the background can take longer to reconnect than the
  // startup timeout. That timeout used to be reported as "Game does not
  // exist", which marked the game ended: the PlayTak icon went out and
  // nothing tried again.
  test("a reconnect that times out doesn't end the game", async ({ page }) => {
    test.setTimeout(120000);
    const server = await mockPlaytakServer(page, OPENING_MOVES);
    // A live game isn't in the history yet, which is how the timeout is told
    // from an ended game
    await page.route(`**/games-history/**`, (route) =>
      route.fulfill({ status: 404, body: "Game does not exist" })
    );
    await startFollowing(page);

    server.state.silentObserves = 1;
    server.drop();

    // The silent connection, then one that gets through
    await expect.poll(() => server.state.observes, { timeout: 60000 }).toBe(2);
    expect(server.state.connections).toBe(3);

    const config = await page.evaluate(() => window.app.$game.config);
    expect(config.playtakLive).toBe(true);
    expect(config.isOngoing).not.toBe(false);

    server.play("P C1");
    await expectMainlineCount(page, OPENING_MOVES.length + 1);
  });

  // Reopening a live game from the PlayTak list used to start a new copy
  // when the one held had been marked ended, leaving its analysis behind
  test("reopening a live game revives the copy marked ended", async ({
    page,
  }) => {
    const server = await mockPlaytakServer(page, OPENING_MOVES);
    await page.route(`**/games-history/**`, (route) =>
      route.fulfill({ status: 404, body: "Game does not exist" })
    );
    await startFollowing(page);

    const before = await page.evaluate(() => {
      const store = window.app.$store;
      store.dispatch("game/STOP_PLAYTAK_FOLLOW");
      store.commit("game/MARK_PLAYTAK_ENDED");
      return {
        name: window.app.$game.name,
        count: store.state.game.list.length,
      };
    });
    expect(await page.evaluate(() => window.app.$game.config.playtakLive)).toBe(
      false
    );

    await page.evaluate(
      ({ id }) => {
        window.app.$store.dispatch("game/ADD_PLAYTAK_GAMES", {
          ids: [id],
          ongoing: true,
          meta: {
            [id]: {
              player1: "alice",
              player2: "bob",
              size: 6,
              komiHalf: 0,
              flats: 30,
              caps: 1,
            },
          },
        });
      },
      { id: GAME_ID }
    );

    await expect.poll(() => server.state.observes, { timeout: 20000 }).toBe(2);
    server.play("P C1");
    await expectMainlineCount(page, OPENING_MOVES.length + 1);

    const after = await page.evaluate(() => ({
      name: window.app.$game.name,
      count: window.app.$store.state.game.list.length,
      live: window.app.$game.config.playtakLive,
    }));
    expect(after).toEqual({ ...before, live: true });
  });
});
