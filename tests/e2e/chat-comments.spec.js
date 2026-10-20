// @ts-check
const { test, expect } = require("@playwright/test");

/**
 * Chat comments ({@player: message}) must survive being written back to PTN.
 *
 * The player prefix was parsed as "2:" (colon included), which Number()
 * turns into NaN: not null, so the comment was filed as chat, but falsy, so
 * toString() dropped the prefix. Any rebuild from PTN (promotion, undo,
 * reload) then turned every chat message into a note.
 */

const PTN = `[Size "6"]

{@1:before the game}

1. a1 {@2:hi} b1 {@1: clock at 20:15}
2. a2 {@Taket: gg} b2
`;

test.describe("Chat comments", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.waitForFunction(() => window.app && window.app.$store, {
      timeout: 30000,
    });
  });

  test("keep their player and message through repeated round trips", async ({
    page,
  }) => {
    const result = await page.evaluate((ptn) => {
      const read = (game) => {
        const out = [];
        Object.keys(game.chatlog)
          .sort((a, b) => a - b)
          .forEach((id) =>
            game.chatlog[id].forEach((c) =>
              out.push({ id: Number(id), player: c.player, message: c.message })
            )
          );
        return {
          chat: out,
          notes: Object.keys(game.notes).length,
        };
      };
      let game = new window.Game({ ptn });
      const first = read(game);
      const texts = [game.ptn];
      for (let i = 0; i < 3; i++) {
        game = new window.Game({ ptn: game.ptn });
        texts.push(game.ptn);
      }
      return { first, last: read(game), texts };
    }, PTN);

    expect(result.first.notes).toBe(0);
    expect(result.first.chat).toEqual([
      { id: -1, player: 1, message: "before the game" },
      { id: 0, player: 2, message: "hi" },
      { id: 1, player: 1, message: "clock at 20:15" },
      { id: 2, player: "Taket", message: "gg" },
    ]);
    expect(result.last).toEqual(result.first);
    // The serialized PTN is stable once written
    expect(new Set(result.texts.slice(1)).size).toBe(1);
  });
});
