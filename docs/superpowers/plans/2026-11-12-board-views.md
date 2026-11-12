# Board Views Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the "3D Board" toggle with a Board View choice of 2D, 2.5D and 3D, where 2.5D is today's tilted board and 3D shows the same tilted board until the WebGL scene exists.

**Architecture:** The view is stored as two flags, the way "Highlight Last Move" is: `board3D` keeps meaning "the board is tilted", and a new `board25D` says the tilted view is the CSS one. One helper module maps the pair to and from `"2d" | "2.5d" | "3d"`; the settings registry shows it as one select. Nothing that reads `board3D` today changes, so the board renders exactly as before.

**Tech Stack:** Vue 2.6, Quasar 1, Vuex 3, Playwright e2e (`tests/e2e`). There is no unit-test runner; pure functions are tested in the page through `window.app`.

**Spec:** `docs/superpowers/specs/2026-11-12-photoreal-3d-board-design.md`, section 1 and step 1 of "Order of work". This is plan 1 of 6; plans 2-4 and 6 (the scene, play, textures, the rest of the board) are written after this one lands, since they build on the names it fixes. Plan 5 (sound) is `2026-11-12-piece-sounds.md` and is independent.

## Global Constraints

- `board3D` keeps its name and, once the scene exists, means the new 3D view. Anyone with it on today, and any embed that sets it, must read as view `"3d"` with **no migration code**.
- `boardRotation`, `perspective` and `orthographic` apply to 2.5D and 3D alike, one stored value each.
- The **D** hotkey toggles between 2D and whichever tilted view was used last.
- 2D and 2.5D behave exactly as they do now. No change to `Board.vue`, `Piece.vue`, `Square.vue` or `AnalysisOverlay.vue` in this plan.
- Read state from the Vuex store and change it through Vuex actions. Never touch a Game object.
- New i18n strings go in `src/i18n/en-us/index.js` in alphabetical order within their category.
- Run `npx prettier --write` on every file you modify.
- Commit through the project's `commit-and-push` skill. No `Co-Authored-By` trailer. Never edit `src/changelog.json` or the `package.json` version.
- Tests: `cd tests && npx playwright test e2e/<spec> --trace off`. The dev server on `localhost:8081` is reused if it is running.

## Review Focus

- **Settings saved before this change** (`board3D: true`, no `board25D` key) must read as `"3d"` and leave Orthographic and Perspective enabled. Task 1, test "old settings read as 3D".
- **An embed whose URL sets `board3D`** (every existing 3D embed) must read as `"3d"`; one that also sets `board25D` as `"2.5d"`. URL settings reach `state.ui` only inside an iframe (`src/layouts/Embed.vue`), so the test must load a real embed. Task 1, test "an embed's URL chooses the view".
- **D after choosing 2.5D** must return to 2.5D, not 3D, and must not disturb the choice when going to 2D. Task 1, test "D returns to the tilted view used last".
- **In 2D, Orthographic and Perspective** are shown but disabled, as they are today under the off toggle. Task 1, test "tilt settings are disabled in 2D".
- **`board25D: true` with `board3D: false`** (a URL that sets only the new flag) is 2D, and choosing or toggling into a tilted view from there gives 2.5D. Task 1, test "the flags map to views".

---

### Task 1: The view as one setting

The whole of step 1 is one change: no part of it is useful, or reviewable, without the rest.

**Files:**

- Create: `src/utils/boardView.js`
- Create: `changelog/unreleased/board-views.json`
- Modify: `src/store/ui/state.js:18` (add the flag after `board3D`)
- Modify: `src/store/ui/getters.js` (add `boardView`)
- Modify: `src/settings/registry.js:258-283` (the `board3D`, `orthographic`, `perspective` entries) and its `UNLISTED` map
- Modify: `src/keymap.js:217` (the hotkey's label)
- Modify: `src/i18n/en-us/index.js`, `src/i18n/en-us/usage.md:188-196`
- Test: `tests/e2e/board-view.spec.js`

**Interfaces:**

- Consumes: `src/utils/moveHighlight.js` as the pattern to follow; `getValue`, `setValue`, `entryState`, `byId` from `src/settings/registry.js` (exposed to tests as `window.app.$settingsRegistry`); the existing `ui/TOGGLE_UI` action, which the D hotkey dispatches with `"board3D"` (`src/layouts/Main.vue:811`, `src/layouts/Embed.vue:354`). The hotkey needs no new code: toggling `board3D` alone returns to the tilted view `board25D` remembers.
- Produces:

  - `src/utils/boardView.js`:
    - `BOARD_VIEWS: ["2d", "2.5d", "3d"]`
    - `BOARD_VIEW_OPTIONS: [{ label: "2D", value: "2d" }, { label: "2.5D", value: "2.5d" }, { label: "3D", value: "3d" }]` (labels are i18n keys)
    - `getBoardView({ board3D, board25D }) => "2d" | "2.5d" | "3d"`
    - `boardViewFlags(view) => { board3D: boolean, board25D?: boolean }`
  - `state.ui.board25D: boolean`, default `false`
  - Vuex getter `ui/boardView => "2d" | "2.5d" | "3d"`
  - Later plans decide "is the WebGL scene showing" with `getters["ui/boardView"] === "3d"`.

- [ ] **Step 1: Write the changelog entry and get it approved**

Create `changelog/unreleased/board-views.json`:

```json
{
  "bump": "patch",
  "changes": [
    {
      "type": "changed",
      "description": "The 3D board is now called 2.5D, and is chosen with a new Board View setting."
    }
  ]
}
```

Run `yarn changelog:check`. Show the entry to Craig and wait for his approval before the first commit (the `commit-and-push` skill's review gate). It covers every commit in this plan. Plan 2 will edit this entry to describe the 3D view and raise the bump to `minor`.

- [ ] **Step 2: Write the failing tests**

`tests/e2e/board-view.spec.js`, using `test`, `expect` and `openApp` from `./helpers` (its shared page). Helpers in the file:

```js
const setUI = (page, key, value) =>
  page.evaluate(
    ([key, value]) => window.app.$store.dispatch("ui/SET_UI", [key, value]),
    [key, value]
  );
const flags = (page) =>
  page.evaluate(() => {
    const { board3D, board25D } = window.app.$store.state.ui;
    return { board3D, board25D };
  });
const view = (page) =>
  page.evaluate(() => window.app.$store.getters["ui/boardView"]);
// The row as the Settings UI sees it
const row = (page, id) =>
  page.evaluate((id) => {
    const r = window.app.$settingsRegistry;
    return r.entryState(
      window.app.$store.state,
      window.app.$store.getters["game/disabledOptions"],
      r.byId(id)
    );
  }, id);
const choose = (page, value) =>
  page.evaluate((value) => {
    const r = window.app.$settingsRegistry;
    return r.setValue(window.app.$store.dispatch, r.byId("ui:board3D"), value);
  }, value);
```

Tests, each starting by setting both flags to `false`:

```js
test("the flags map to views", async ({ page }) => {
  for (const [board3D, board25D, expected] of [
    [false, false, "2d"],
    [false, true, "2d"],
    [true, true, "2.5d"],
    [true, false, "3d"],
  ]) {
    await setUI(page, "board3D", board3D);
    await setUI(page, "board25D", board25D);
    expect(await view(page)).toBe(expected);
    expect((await row(page, "ui:board3D")).value).toBe(expected);
  }
});

test("choosing a view sets the flags", async ({ page }) => {
  await choose(page, "2.5d");
  expect(await flags(page)).toEqual({ board3D: true, board25D: true });
  await choose(page, "3d");
  expect(await flags(page)).toEqual({ board3D: true, board25D: false });
  await choose(page, "2.5d");
  await choose(page, "2d");
  // 2D leaves the tilted choice alone, so D can return to it
  expect(await flags(page)).toEqual({ board3D: false, board25D: true });
});

test("old settings read as 3D", async ({ page }) => {
  // What a browser that had 3D on before this change holds
  await setUI(page, "board3D", true);
  await setUI(page, "board25D", false);
  expect(await view(page)).toBe("3d");
  expect((await row(page, "ui:orthographic")).disabled).toBe(false);
  expect(await page.locator(".board-space.board-3D").count()).toBe(1);
});

test("tilt settings are disabled in 2D", async ({ page }) => {
  await choose(page, "2d");
  expect((await row(page, "ui:orthographic")).disabled).toBe(true);
  expect((await row(page, "ui:perspective")).disabled).toBe(true);
  await choose(page, "2.5d");
  expect((await row(page, "ui:orthographic")).disabled).toBe(false);
  expect(await page.locator(".board-space.board-3D").count()).toBe(1);
});
```

Two more tests need their own pages. The hotkey test opens the app as `tests/e2e/stack-counts-hotkey.spec.js` does (click the board's corner and press Escape first, so the page has focus):

```js
test("D returns to the tilted view used last", async ({ page }) => {
  // …open as stack-counts-hotkey.spec.js does…
  await choose(page, "2.5d");
  await page.keyboard.press("d");
  await expect.poll(() => view(page)).toBe("2d");
  await page.keyboard.press("d");
  await expect.poll(() => view(page)).toBe("2.5d");
  await choose(page, "3d");
  await page.keyboard.press("d");
  await page.keyboard.press("d");
  await expect.poll(() => view(page)).toBe("3d");
});
```

The embed test loads the app in an iframe, as "embed hides disabled options and their children" in `tests/e2e/settings.spec.js:752` does, and reads the store inside the frame with `frame.locator("body").evaluate(...)`:

```js
test("an embed's URL chooses the view", async ({ page }) => {
  for (const [params, expected] of [
    ["&board3D=true", "3d"],
    ["&board3D=true&board25D=true", "2.5d"],
    ["&board25D=true", "2d"],
  ]) {
    // …open an embed of '[Size "5"]\n\n1. a1 e5' with `params`…
    await expect
      .poll(() =>
        frame
          .locator("body")
          .evaluate(() => window.app.$store.getters["ui/boardView"])
      )
      .toBe(expected);
    await expect(frame.locator(".board-space.board-3D")).toHaveCount(
      expected === "2d" ? 0 : 1
    );
  }
});
```

- [ ] **Step 3: Run them to see them fail**

Run: `cd tests && npx playwright test e2e/board-view.spec.js --trace off`
Expected: FAIL. The store has no `ui/boardView` getter and the row's value is a boolean. "D returns to the tilted view used last" fails at its first `choose`.

- [ ] **Step 4: Write `src/utils/boardView.js`**

Follow `src/utils/moveHighlight.js` in shape and comment style. The mapping:

| `board3D` | `board25D` | view     |
| --------- | ---------- | -------- |
| false     | either     | `"2d"`   |
| true      | true       | `"2.5d"` |
| true      | false      | `"3d"`   |

`boardViewFlags("2d")` returns only `{ board3D: false }`, leaving `board25D` as it is. `"2.5d"` returns `{ board3D: true, board25D: true }`; `"3d"` returns `{ board3D: true, board25D: false }`.

- [ ] **Step 5: Add the flag and the getter**

`src/store/ui/state.js`: `board25D: false,` on the line after `board3D: false,`.
`src/store/ui/getters.js`: `export const boardView = (state) => getBoardView(state);`

- [ ] **Step 6: Change the registry row**

In `src/settings/registry.js`:

- The `board3D` entry becomes a select, as `highlightSquares` is: `label: "Board View"`, `control: "select"`, `options: BOARD_VIEW_OPTIONS`, `keywords: ["3D", "2.5D", "tilt", "perspective"]`, `get: (rootState) => getBoardView(rootState.ui)`, `set` dispatching `ui/SET_UI` for each flag `boardViewFlags(value)` returns. Keep `category`, `section`, `hotkey: "board3D"` and `sync: "board3D"`.
- `orthographic` and `perspective` keep `dependsOn: "ui:board3D"` (for their place under the row) but a select's value is never falsy, so each needs `disabledWhen` to cover 2D: `orthographic` gets `disabledWhen: (rootState) => !rootState.ui.board3D`; `perspective`'s becomes `!rootState.ui.board3D || Boolean(rootState.ui.orthographic)`.
- Add `"ui:board25D": "board3D"` to `UNLISTED`, in alphabetical place. (`tests/e2e/settings.spec.js` fails if a state key is in neither list.)

- [ ] **Step 7: Strings and docs**

`src/i18n/en-us/index.js`: add `"2D": "2D"`, `"2.5D": "2.5D"`, `"3D": "3D"`, `"Board View": "Board View"` and `"Tilt Board": "Tilt Board"`; remove `"3D Board"`.
`src/keymap.js:217`: the `board3D` hotkey's label becomes `"Tilt Board"`.
`src/i18n/en-us/usage.md`: retitle the "3D Mode" section "Board Views" and replace its first paragraph and first bullet with:

```md
While the 2D view gives a more analytical view of the board, the 2.5D view tilts it to offer some semblance of how the game might look on a physical board.

- Choose the view under **Board Preferences**, in the corner of the board area, or switch between 2D and the tilted view you used last with the hotkey <kbd>D</kbd>.
```

The two bullets about rotating the board stay as they are.

- [ ] **Step 8: Run the tests**

Run: `cd tests && npx playwright test e2e/board-view.spec.js e2e/settings.spec.js e2e/no-page-errors.spec.js --trace off`
Expected: PASS.

- [ ] **Step 9: Commit**

Format, then commit with the `commit-and-push` skill: "Offer the tilted board as 2.5D in a Board View setting".
