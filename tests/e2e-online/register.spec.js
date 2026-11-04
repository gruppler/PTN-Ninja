// @ts-check
/**
 * Registering through the store's REGISTER flow ties the name to the account:
 * the server accepts the new account's name when it creates a game.
 */
const { test, expect } = require("@playwright/test");
const { signInAsGuest } = require("./helpers");

test("a newly registered player creates a game under their registered name", async ({
  page,
}) => {
  const name = `Reg${Date.now().toString(36)}`;
  const uid = await signInAsGuest(page);
  await page.evaluate(
    (name) =>
      window.app.$store.dispatch("online/REGISTER", {
        email: `${name.toLowerCase()}@example.com`,
        password: "password123",
        name: ` ${name} `,
      }),
    name
  );
  const user = await page.evaluate(() => {
    const { uid, displayName, isAnonymous } =
      window.app.$store.state.online.user;
    return { uid, displayName, isAnonymous };
  });
  expect(user).toEqual({ uid, displayName: name, isAnonymous: false });

  // The name is claimed for this account
  const owner = await page.evaluate(
    async (name) =>
      (
        await window.db.collection("names").doc(name.toLowerCase()).get()
      ).data(),
    name
  );
  expect(owner).toEqual({ uid });

  // The server checks the token's name against the claim
  const tags = await page.evaluate(async () => {
    const { data } = await window.functions.httpsCallable("createGame")({
      config: { isPrivate: false, playerSeat: 1 },
      tags: { size: 5, komi: 0, opening: "swap" },
      tps: "x5/x5/x5/x5/x5 1 1",
    });
    const game = await window.db.doc(`gamesPublic/${data.id}`).get();
    return game.data().tags;
  });
  expect(tags.player1).toBe(name);
});
