// @ts-check
const { test, expect, loadPTN, setProtectedMainline } = require("./helpers");

/**
 * Scratch moves in a live game: moves a spectator tries out past, or beside,
 * what has actually been played. They are shown faded wherever they are, and
 * Parent Main Branch leads back to the latest move played.
 */

// The first two plies have been played; c3 and c4 are the spectator's own
const GAME = `[Size "5"]

1. a1 e5 2. c3 c4`;

const dispatch = (page, action, payload) =>
  page.evaluate(
    ([action, payload]) => window.app.$store.dispatch(action, payload),
    [action, payload]
  );

// A ply can be rendered in more than one place
const faded = (page) =>
  page.evaluate(() =>
    [
      ...new Set(
        [...document.querySelectorAll(".ptn.ply.unsynced")].map(
          (el) => el.dataset.plyText
        )
      ),
    ].sort()
  );

const at = (page) =>
  page.evaluate(() => {
    const { ply, plyIsDone } = window.app.$store.state.game.position;
    return ply ? ply.text + (plyIsDone ? "" : " (not done)") : null;
  });

// The Parent Main Branch button under the move list
const mainButton = (page) =>
  page.evaluateHandle(() =>
    [...document.querySelectorAll(".q-btn")].find(
      (el) => el.__vue__ && el.__vue__.icon === "parent_main"
    )
  );
const mainButtonEnabled = async (page) =>
  (await mainButton(page)).evaluate((el) => !el.__vue__.disable);
// It is lit whenever there is somewhere to return to
const mainButtonLit = async (page) =>
  (await mainButton(page)).evaluate((el) => el.__vue__.color === "primary");

test.beforeEach(async ({ page }) => {
  await dispatch(page, "ui/SET_UI", ["showPTN", true]);
  await loadPTN(page, GAME);
  await setProtectedMainline(page, 2);
});

test("every scratch move is faded, in whichever branch", async ({ page }) => {
  await expect.poll(() => faded(page)).toEqual(["c3", "c4"]);

  // A second line from the live position
  await dispatch(page, "game/GO_TO_PLY", { plyID: 1, isDone: true });
  await dispatch(page, "game/INSERT_PLY", "d4");
  await dispatch(page, "game/INSERT_PLY", "d5");
  await expect
    .poll(async () => (await faded(page)).filter((ply) => /^d/.test(ply)))
    .toEqual(["d4", "d5"]);

  // A line that leaves the game at an earlier, played move
  await dispatch(page, "game/GO_TO_PLY", { plyID: 0, isDone: true });
  await dispatch(page, "game/INSERT_PLY", "b2");
  await expect.poll(() => faded(page)).toContain("b2");

  // The moves that were played never fade
  const all = await faded(page);
  expect(all).not.toContain("a1");
  expect(all).not.toContain("e5");
});

test("Parent Main Branch returns from a scratch move to the latest move played", async ({
  page,
}) => {
  // On a played move there is nowhere to return to
  await dispatch(page, "game/GO_TO_PLY", { plyID: 1, isDone: true });
  expect(await mainButtonEnabled(page)).toBe(false);

  // Playing ahead on the main line
  await dispatch(page, "game/GO_TO_PLY", { plyID: 3, isDone: true });
  await expect.poll(() => at(page)).toBe("c4");
  await expect.poll(() => mainButtonEnabled(page)).toBe(true);
  expect(await mainButtonLit(page)).toBe(true);
  await (await mainButton(page)).evaluate((el) => el.click());
  await expect.poll(() => at(page)).toBe("e5");
  await expect.poll(() => mainButtonEnabled(page)).toBe(false);
  expect(await mainButtonLit(page)).toBe(false);

  // From a scratch branch: first to the main line, then to the played move
  await dispatch(page, "game/INSERT_PLY", "d4");
  await expect.poll(() => at(page)).toBe("d4");
  await expect.poll(() => mainButtonLit(page)).toBe(true);
  await dispatch(page, "game/PARENT_MAIN_BRANCH");
  await expect.poll(() => at(page)).toBe("c3");
  await dispatch(page, "game/PARENT_MAIN_BRANCH");
  await expect.poll(() => at(page)).toBe("e5");
});

test("in a game that isn't live, the main line has no way back", async ({
  page,
}) => {
  await loadPTN(page, GAME);
  await dispatch(page, "game/GO_TO_PLY", { plyID: 3, isDone: true });
  await expect.poll(() => at(page)).toBe("c4");
  expect(await mainButtonEnabled(page)).toBe(false);
  expect(await mainButtonLit(page)).toBe(false);
  await dispatch(page, "game/PARENT_MAIN_BRANCH");
  expect(await at(page)).toBe("c4");
  expect(await faded(page)).toEqual([]);

  // A branch does, live or not
  await dispatch(page, "game/GO_TO_PLY", { plyID: 1, isDone: true });
  await dispatch(page, "game/INSERT_PLY", "d4");
  await expect.poll(() => mainButtonLit(page)).toBe(true);
  await (await mainButton(page)).evaluate((el) => el.click());
  await expect.poll(() => at(page)).toBe("c3");
  await expect.poll(() => mainButtonLit(page)).toBe(false);
});
