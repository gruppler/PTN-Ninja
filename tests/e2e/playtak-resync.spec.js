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
  const state = { connections: 0, observes: 0, moves: [...moves] };

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
});
