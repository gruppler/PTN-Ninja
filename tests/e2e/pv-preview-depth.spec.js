// @ts-check
const { test, expect } = require("@playwright/test");

/**
 * The PV preview keeps the depth you've stepped to across engine updates, as
 * long as every move up to it is unchanged. It used to reset to the hovered
 * move whenever the PV changed at all, even if the engine only extended it or
 * changed moves past the previewed position.
 */

test("PV preview depth survives updates that keep the moves up to it", async ({
  page,
}) => {
  await page.goto("/");
  await page.waitForFunction(() => window.app && window.app.$store, {
    timeout: 30000,
  });
  const result = await page.evaluate(async () => {
    const s = window.app.$store;
    await s.dispatch("game/ADD_GAME", {
      ptn: `[Size "6"]\n[Opening "swap"]\n\n1. a6 f1\n`,
      name: "PV Preview",
    });
    const settle = () => new Promise((r) => setTimeout(r, 400));
    await settle();
    s.commit("analysis/SET", ["botID", "tiltak"]);
    await s.dispatch("analysis/SET", ["analysisSource", "engines"]);
    await s.dispatch("analysis/SET", ["preferSavedResults", false]);
    await s.dispatch("ui/SET_UI", ["showText", true]);
    await s.dispatch("ui/SET_UI", ["textTab", "engines"]);
    const bot = s.getters["analysis/bot"];
    const PlyC = window.app.$game.plies[0].constructor;
    const seed = (moves) => {
      const tps = s.state.game.position.tps;
      const [first, ...rest] = moves.map((m) => new PlyC(m));
      bot.setPosition(tps, [
        {
          ply: first,
          followingPlies: rest,
          depth: 10,
          nodes: 1000,
          time: 1000,
          evaluation: 0.1,
          hash: bot.getSettingsHash(),
        },
      ]);
    };
    seed(["d4", "c3", "d3", "c4", "d5"]);
    await settle();

    const walk = (vm, out = []) => {
      if (vm.$options.name === "PlyTooltipProvider") out.push(vm);
      vm.$children.forEach((c) => walk(c, out));
      return out;
    };
    const tip = walk(window.app.$root)[0];
    document
      .querySelector("[data-pv][data-pv-index='1']")
      .dispatchEvent(new MouseEvent("mouseover", { bubbles: true }));
    await settle();
    // Step the preview to the third move, as scrolling over the PV does
    tip.pvNavIndex = 3;
    const step = () => ({
      depth: tip.pvNavIndexClamped,
      pv: tip.pvNav && tip.pvNav.pv.join(" "),
    });

    const out = { start: step() };
    seed(["d4", "c3", "d3", "c4", "d5", "e4", "e5"]);
    await settle();
    out.extended = step();
    seed(["d4", "c3", "d3", "b4", "b5"]);
    await settle();
    out.changedAfter = step();
    seed(["d4", "e3", "d3", "b4", "b5"]);
    await settle();
    out.changedBefore = step();
    return out;
  });

  expect(result.start).toEqual({ depth: 3, pv: "d4 c3 d3 c4 d5" });
  expect(result.extended).toEqual({ depth: 3, pv: "d4 c3 d3 c4 d5 e4 e5" });
  expect(result.changedAfter).toEqual({ depth: 3, pv: "d4 c3 d3 b4 b5" });
  // A move before the previewed one changed: back to the hovered move
  expect(result.changedBefore).toEqual({ depth: 1, pv: "d4 e3 d3 b4 b5" });
});
