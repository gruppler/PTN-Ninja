// @ts-check
const { test, expect } = require("@playwright/test");
const { compressToEncodedURIComponent: compress } = require("lz-string");

/**
 * URL compatibility
 *
 * Full URLs and short links that already exist in the wild (shared links,
 * printed and shared QR codes) must keep loading. There are no online-game
 * URLs in the wild, so none of these may be captured by the online routes.
 *
 * The formats are production's (main):
 *  - Full URL, from the `ui/url` getter:
 *      /<lz(PTN)>&name=<lz(name)>&targetBranch=<lz(branch)>&ply=<index>[!]&theme=<lz(id)>
 *    Every param value goes through encodeURIComponent, with ( and ) escaped.
 *    The `local` route (`/:ptn([^&]+)?:state(.*)?`) splits it, and
 *    parseURLparams decompresses the PTN (when it only uses the compressed
 *    alphabet), name, targetBranch and theme.
 *  - Short link: /s/<id>. The `shortened` route redirects to the local route,
 *    whose beforeEnter fetches SHORTENER_SERVICE + "?id=<id>" and navigates to
 *    the local route with { ptn, state: params }, both plain text. A failed
 *    fetch (non-ok response) shows an error and opens the previous or a new game.
 */

const PTN = `[Size "5"]
[Opening "swap"]

1. a1 e5
2. a2 e4
3. a3 e3

{3w1}
3. b1 e2
4. b2 e1
`;

const NAME = "Url Compat (v2)";
const BRANCH = "3w1";
// Ply 6 is b2 in the branch (0 a1, 1 e5, 2 a2, 3 e4, 4 b1, 5 e2, 6 b2)
const PLY_INDEX = 6;

// Matches the SHORTENER_SERVICE of any build (production or emulator)
const SHORTENER = /\/us-central1\/short(\?|$)/;

// Same encoding as the ui/url getter
const urlEncode = (value) =>
  encodeURIComponent(value).replace(
    /([()])/g,
    (char) => "%" + char.charCodeAt(0).toString(16)
  );

/** Build a full URL path the way production's ui/url getter does */
function fullURL({ ptn = PTN, params = {}, compressed = true } = {}) {
  let url = "/" + (compressed ? compress(ptn) : ptn);
  const entries = Object.entries(params);
  if (entries.length) {
    url +=
      "&" +
      entries.map(([key, value]) => key + "=" + urlEncode(value)).join("&");
  }
  return url;
}

const fullParams = () => ({
  name: compress(NAME),
  targetBranch: compress(BRANCH),
  ply: PLY_INDEX + "!",
  theme: compress("panda"),
});

/** Record whether the app tries to open or list an online game */
async function watchOnline(page) {
  const seen = { dispatches: [], errors: [], requests: [] };
  await page.addInitScript(() => {
    window.__onlineDispatches = [];
    const hook = () => {
      const store = window.app && window.app.$store;
      if (!store) {
        return setTimeout(hook, 10);
      }
      const dispatch = store.dispatch.bind(store);
      store.dispatch = (type, ...args) => {
        if (/^online\//.test(type)) {
          window.__onlineDispatches.push(type);
        }
        return dispatch(type, ...args);
      };
    };
    hook();
  });
  page.on("pageerror", (error) => {
    // Raised by the persistence layer when the game list and IndexedDB
    // disagree; a dev-environment artifact (also ignored in helpers.js)
    if (!/Game not found/.test(error.message)) {
      seen.errors.push(error.message);
    }
  });
  page.on("request", (request) => {
    if (/firestore\.googleapis\.com|:8080\//.test(request.url())) {
      seen.requests.push(request.url());
    }
  });
  return seen;
}

async function waitForApp(page) {
  await page.waitForFunction(
    () => window.app && window.app.$store && window.app.$game,
    null,
    { timeout: 30000 }
  );
}

/** Read the loaded game from the page */
function readGame(page) {
  return page.evaluate(() => {
    const game = window.app.$game;
    return {
      name: game.name,
      ptn: game.ptn,
      size: game.tag("size") || (game.board && game.board.size),
      plyIndex: game.board.plyIndex,
      plyIsDone: game.board.plyIsDone,
      targetBranch: game.board.targetBranch,
      games: window.app.$store.state.game.list.length,
      path: window.location.pathname,
      routeName: window.app.$route.name,
      errors: [...document.querySelectorAll(".q-notification")].map(
        (el) => el.textContent
      ),
    };
  });
}

async function expectNoOnline(page, seen) {
  const dispatches = await page.evaluate(() => window.__onlineDispatches);
  expect(dispatches.filter((type) => /OPEN_GAME/.test(type))).toEqual([]);
  expect(seen.requests, "no Firestore requests").toEqual([]);
  const route = await page.evaluate(() => window.app.$route.name);
  expect(route).not.toMatch(/online/i);
  const text = await page.evaluate(() => document.body.innerText);
  expect(text).not.toMatch(/Game unavailable/i);
}

test.describe("existing URLs keep working", () => {
  test("full URL with compressed PTN, name, branch, ply and theme", async ({
    page,
  }) => {
    const seen = await watchOnline(page);
    await page.goto(fullURL({ params: fullParams() }));
    await waitForApp(page);

    const game = await readGame(page);
    expect(game.name).toBe(NAME);
    expect(game.ptn).toContain("3. b1 e2");
    expect(game.ptn).toContain("4. b2 e1");
    expect(game.ptn).toContain("3. a3 e3");
    expect(game.ptn).toContain(`{${BRANCH}}`);
    expect(game.targetBranch).toBe(BRANCH);
    expect(game.plyIndex).toBe(PLY_INDEX);
    expect(game.plyIsDone).toBe(true);
    expect(game.routeName).toBe("localGame");
    // The theme param is parsed but only the embed layout applies it; the
    // URL must still load with it present
    await expectNoOnline(page, seen);
    expect(seen.errors).toEqual([]);
  });

  test("full URL without a name takes the name from the PTN", async ({
    page,
  }) => {
    const ptn = PTN.replace(
      '[Opening "swap"]',
      '[Opening "swap"]\n[Event "Cup"]'
    );
    await page.goto(fullURL({ ptn }));
    await waitForApp(page);
    const game = await readGame(page);
    expect(game.ptn).toContain('[Event "Cup"]');
    expect(game.ptn).toContain("4. b2 e1");
  });

  test("full URL with uncompressed PTN", async ({ page }) => {
    const seen = await watchOnline(page);
    // Production's parser decompresses the path only when it is made of
    // [A-Za-z0-9$+-]; PTN with spaces, brackets and quotes is taken as is
    const ptn = '[Size "4"]\n[Opening "swap"]\n\n1. a1 d4\n2. a2 d3\n';
    const path =
      "/" + encodeURIComponent(ptn) + "&name=" + urlEncode(compress(NAME));
    // The dev server answers 404 for paths containing "." (it takes them for
    // files), where production hosting rewrites every path to index.html.
    // Serve index.html for this document request, keeping the URL.
    await page.route("**" + path.slice(0, 20) + "**", async (route) => {
      if (route.request().resourceType() !== "document") {
        return route.continue();
      }
      const response = await route.fetch({ url: "http://localhost:8081/" });
      await route.fulfill({ response });
    });
    await page.goto(path);
    await waitForApp(page);

    const game = await readGame(page);
    expect(game.name).toBe(NAME);
    expect(game.ptn).toContain('[Size "4"]');
    expect(game.ptn).toContain("2. a2 d3");
    await expectNoOnline(page, seen);
    expect(seen.errors).toEqual([]);
  });

  test("short link /s/<id> expands to the stored game", async ({ page }) => {
    const seen = await watchOnline(page);
    const requests = [];
    // What the shortener returns: the plain-text PTN and params (see
    // GET_SHORT_URL, which stores them as given, ply as "<index>[!]")
    await page.route(SHORTENER, async (route) => {
      requests.push(route.request().url());
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        headers: { "access-control-allow-origin": "*" },
        body: JSON.stringify({
          ptn: PTN,
          params: {
            name: NAME,
            targetBranch: BRANCH,
            ply: PLY_INDEX + "!",
          },
        }),
      });
    });
    await page.goto("/s/abc123");
    await waitForApp(page);

    expect(requests).toHaveLength(1);
    expect(requests[0]).toContain("id=abc123");
    const game = await readGame(page);
    expect(game.name).toBe(NAME);
    expect(game.ptn).toContain("4. b2 e1");
    expect(game.targetBranch).toBe(BRANCH);
    expect(game.plyIndex).toBe(PLY_INDEX);
    expect(game.plyIsDone).toBe(true);
    expect(game.routeName).toBe("localGame");
    await expectNoOnline(page, seen);
    expect(seen.errors).toEqual([]);
  });

  test("a missing short link fails gracefully", async ({ page }) => {
    const seen = await watchOnline(page);
    await page.route(SHORTENER, async (route) => {
      await route.fulfill({
        status: 404,
        contentType: "application/json",
        headers: { "access-control-allow-origin": "*" },
        body: JSON.stringify({ message: "Short link not found" }),
      });
    });
    await page.goto("/s/nope");
    await waitForApp(page);

    // The app still opens (a fresh game), with no uncaught errors and no
    // attempt to treat the id as an online game
    const game = await readGame(page);
    expect(game.ptn).toBeTruthy();
    expect(game.routeName).toBe("localGame");
    expect(game.path).not.toContain("/s/");
    await expectNoOnline(page, seen);
    expect(seen.errors).toEqual([]);
  });
});
