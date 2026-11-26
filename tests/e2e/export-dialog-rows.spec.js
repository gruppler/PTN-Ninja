// @ts-check
const { test, expect } = require("@playwright/test");
const { compressToEncodedURIComponent: compress } = require("lz-string");
const crypto = require("crypto");

/**
 * The image, GIF and embed dialogs show the shared settings rows, grouped
 * and ordered as the Settings dialog shows them, editing the dialog's own
 * config rather than the live settings.
 */

const PTN = `[Date "2024.01.02"]
[Player1 "Alice"]
[Player2 "Bob"]
[Size "5"]

1. a1 e5 2. c3 Sc4 3. Cd3 a2 4. d3< b2 5. 2c3<11`;

// `nested`: the board options sit in config.ui
// `bare`: the keys of the config that no row of the dialog edits (a
// slider, the theme selector or the embed's size fields edit some; the
// Highlight Last Move row writes highlightPieces with highlightSquares; the
// rest the dialog keeps as they are), and for the embed, `bareUI` those of
// config.ui
const DIALOGS = [
  {
    route: "image",
    config: "pngConfig",
    nested: false,
    bare: ["bgAlpha", "highlightPieces", "imageSize", "textSize", "themeID"],
  },
  {
    route: "gif",
    config: "gifConfig",
    nested: false,
    bare: [
      "highlightPieces",
      "imageSize",
      "playSpeed",
      "plyRange",
      "textSize",
      "themeID",
    ],
  },
  {
    route: "embed",
    config: "embedConfig",
    nested: true,
    bare: ["height", "ui", "width"],
    bareUI: [
      "boardEvalBar",
      "gameTimer",
      "highlightPieces",
      "inlineBranches",
      "showAnalysisBoard",
      "showEval",
      "showToolbarAnalysis",
      "themeID",
    ],
  },
];

const openGame = async (page) => {
  await page.goto("/" + compress(PTN));
  await page.waitForFunction(() => window.app && window.app.$store, null, {
    timeout: 30000,
  });
  await page.waitForSelector(".stone");
  await page.evaluate(() =>
    window.app.$store.dispatch("ui/SET_UI", ["animateBoard", false])
  );
};

const openDialog = async (page, route) => {
  await page.evaluate((route) => {
    window.app.$router.push("/" + route);
  }, route);
  await page.locator(".q-dialog .q-item").first().waitFor();
};

// A row of the dialog by its exact label
const row = (page, label) =>
  page
    .locator(".q-dialog .q-item")
    .filter({
      has: page.locator(".q-item__label", {
        hasText: new RegExp(`^\\s*${label}\\s*$`),
      }),
    })
    .first();

const toggle = async (page, label) => {
  const box = row(page, label).locator(".q-toggle");
  const before = await box.getAttribute("aria-checked");
  await box.click();
  await expect(box).not.toHaveAttribute("aria-checked", String(before));
};

// Highlight Last Move: a row of buttons, or (before) a select
const chooseHighlight = async (page, option) => {
  const dialog = page.locator(".q-dialog");
  const name = new RegExp(`^${option}$`);
  const buttons = dialog.locator(
    '[data-setting="ui:highlightSquares"] .setting-buttons button'
  );
  if (await buttons.count()) {
    await buttons.filter({ hasText: name }).click();
    return;
  }
  await dialog.locator(".q-select", { hasText: "Highlight Last Move" }).click();
  await page.locator(".q-menu .q-item", { hasText: name }).click();
};

const sha = (text) => crypto.createHash("sha256").update(text).digest("hex");

// The dialog's component, searched for from the app's root
const fromDialog = (page, name, read) =>
  page.evaluate(
    ([name, read]) => {
      const find = (vm) => {
        if (vm.$options.name === name) return vm;
        for (const child of vm.$children) {
          const found = find(child);
          if (found) return found;
        }
        return null;
      };
      const vm = find(window.app);
      // eslint-disable-next-line no-new-func
      return new Function("vm", "return " + read)(vm);
    },
    [name, read]
  );

const stored = (page, config) =>
  page.evaluate((config) => {
    const value = JSON.parse(
      JSON.stringify(window.app.$store.state.ui[config])
    );
    if (value.theme) delete value.theme;
    if (value.ui && value.ui.theme) delete value.ui.theme;
    return value;
  }, config);

const withoutOrigin = (page, url) =>
  page.evaluate((url) => url.split(location.origin).join(""), url);

test.describe("export results", () => {
  test.beforeEach(async ({ page }) => {
    await openGame(page);
    // The image and GIF from the same choices as then, when Partial Roads
    // started on (an embed leaves a default out of its link, so it needs no
    // such start)
    await page.evaluate(() => {
      const { state, dispatch } = window.app.$store;
      ["pngConfig", "gifConfig"].forEach((key) =>
        dispatch("ui/SET_UI", [key, { ...state.ui[key], showRoads: true }])
      );
    });
  });

  // The values below were captured on the commit before the dialogs used
  // the settings rows, from the same choices
  test("an image link is what it was for the same choices", async ({
    page,
  }) => {
    await openDialog(page, "image");
    await toggle(page, "Stack Counts");
    await toggle(page, "Partial Roads");
    await toggle(page, "Small Axis Labels");
    await toggle(page, "Player Names");
    await toggle(page, "Padding");
    await toggle(page, "Evaluation Text");
    await chooseHighlight(page, "Pieces");
    await expect
      .poll(() => stored(page, "pngConfig").then((c) => c.highlightPieces))
      .toBe(true);
    const url = await page.evaluate(() =>
      window.app.$store.getters["ui/png_url"]()
    );
    const config = await stored(page, "pngConfig");
    expect({ config, url: sha(url) }).toEqual(PINNED.image);
  });

  test("a GIF request is what it was for the same choices", async ({
    page,
  }) => {
    await openDialog(page, "gif");
    await toggle(page, "Stack Counts");
    await toggle(page, "Flat Win Highlights");
    await toggle(page, "Delay Analysis");
    await toggle(page, "Visualize Suggestions");
    await toggle(page, "Transparent Background");
    await toggle(page, "Player Names");
    await toggle(page, "Vertical Layout");
    await chooseHighlight(page, "None");
    await expect
      .poll(() => stored(page, "gifConfig").then((c) => c.highlightSquares))
      .toBe(false);
    const url = await withoutOrigin(
      page,
      await fromDialog(page, "GIFConfig", "vm.url")
    );
    const config = await stored(page, "gifConfig");
    expect({ config, url: sha(url) }).toEqual(PINNED.gif);
  });

  test("an embed link is what it was for the same choices", async ({
    page,
  }) => {
    await openDialog(page, "embed");
    await toggle(page, "Disable Notes");
    await toggle(page, "Scrub Bar");
    await toggle(page, "Note Notifications");
    await toggle(page, "Player Names");
    await toggle(page, "Move Number");
    await toggle(page, "Auto Layout");
    await toggle(page, "Board Transform Button");
    await chooseHighlight(page, "Pieces");
    await expect
      .poll(() => stored(page, "embedConfig").then((c) => c.ui.highlightPieces))
      .toBe(true);
    const url = await withoutOrigin(
      page,
      await fromDialog(page, "EmbedConfig", "vm.url")
    );
    const code = await withoutOrigin(
      page,
      await fromDialog(page, "EmbedConfig", "vm.code")
    );
    const config = await stored(page, "embedConfig");
    expect({ config, url: sha(url), code: sha(code) }).toEqual(PINNED.embed);
  });
});

// The board options of a dialog's stored config, and the live ones
const values = (page, { config, nested }, key) =>
  page.evaluate(
    ([config, nested, key]) => {
      const ui = window.app.$store.state.ui;
      const own = nested ? ui[config].ui : ui[config];
      return { own: own[key], live: ui[key] };
    },
    [config, nested, key]
  );

const setLive = (page, key, value) =>
  page.evaluate(
    ([key, value]) => window.app.$store.dispatch("ui/SET_UI", [key, value]),
    [key, value]
  );

// The shared rows of the open dialog, in order, with their section
const dialogRows = (page) =>
  page.evaluate(() =>
    [
      ...document.querySelectorAll(
        ".q-dialog .settings-sections [data-setting]"
      ),
    ]
      .filter((el) => !el.dataset.setting.startsWith("export:"))
      .map((el) => ({
        id: el.dataset.setting,
        section: el.closest("[data-section]").dataset.section,
      }))
  );

// Every row of the Settings dialog, category by category, in order
const settingsRows = async (page) => {
  const categories = await page.evaluate(() =>
    window.app.$settingsRegistry.CATEGORIES.map(({ id }) => id)
  );
  const rows = [];
  for (const category of categories) {
    await page.evaluate((category) => {
      window.app.$router.replace("/settings/" + category);
    }, category);
    await page
      .locator(`.settings-dialog [data-section^="${category}/"]`)
      .first()
      .waitFor();
    rows.push(
      ...(await page.evaluate(() =>
        [
          ...document.querySelectorAll(
            ".settings-dialog .settings-category [data-setting]"
          ),
        ].map((el) => ({
          id: el.dataset.setting,
          section: el.closest("[data-section]").dataset.section,
        }))
      ))
    );
  }
  return rows;
};

// The row right after a row, if it is that row's child: inside its
// .setting-row and indented
const childAfter = (page, id) =>
  page.evaluate((id) => {
    const parent = document.querySelector(`.q-dialog [data-setting="${id}"]`);
    const rows = [...document.querySelectorAll(".q-dialog [data-setting]")];
    const next = rows[rows.indexOf(parent) + 1];
    const indented =
      parseFloat(getComputedStyle(next).paddingLeft) >
      parseFloat(getComputedStyle(parent).paddingLeft);
    return parent.parentElement.contains(next) && indented
      ? next.dataset.setting
      : null;
  }, id);

for (const dialog of DIALOGS) {
  test.describe(`${dialog.route} dialog rows`, () => {
    test.beforeEach(async ({ page }) => {
      await openGame(page);
    });

    test("the shared rows follow the Settings dialog's sections and order", async ({
      page,
    }) => {
      await openDialog(page, dialog.route);
      const rows = await dialogRows(page);
      expect(rows.length).toBeGreaterThan(10);
      await page.evaluate(() => {
        window.app.$router.back();
      });
      await expect(page.locator(".q-dialog")).toHaveCount(0);
      const ids = rows.map(({ id }) => id);
      const settings = (await settingsRows(page)).filter(({ id }) =>
        ids.includes(id)
      );
      expect(rows).toEqual(settings);
      // Each section is headed by its category and section
      await openDialog(page, dialog.route);
      const titles = await page
        .locator(".q-dialog .settings-sections .settings-section-header")
        .allInnerTexts();
      expect(titles[0]).toBe("Board › On the Board");
      // and by the category alone where the section would repeat it
      titles.forEach((title) => expect(title).not.toMatch(/^(.+) › \1$/));
      if (dialog.route === "embed") {
        expect(titles).toContain("Notifications");
      }
    });

    test("every key of the config has a row, but those that have none", async ({
      page,
    }) => {
      await openDialog(page, dialog.route);
      const rows = await page.evaluate(() =>
        [...document.querySelectorAll(".q-dialog [data-setting]")].map(
          (el) => el.dataset.setting
        )
      );
      const keys = await page.evaluate(
        ([config, nested]) => {
          const value = window.app.$store.state.ui[config];
          return {
            own: Object.keys(value),
            ui: nested ? Object.keys(value.ui) : [],
          };
        },
        [dialog.config, dialog.nested]
      );
      const keysOf = (store) =>
        rows
          .filter((id) => id.startsWith(store + ":"))
          .map((id) => id.split(":")[1]);
      const sorted = (list) => [...new Set(list)].sort();
      if (dialog.nested) {
        expect(sorted(keys.own)).toEqual(
          sorted([...keysOf("export"), ...dialog.bare])
        );
        expect(sorted(keys.ui)).toEqual(
          sorted([...keysOf("ui"), ...dialog.bareUI])
        );
      } else {
        expect(sorted(keys.own)).toEqual(
          sorted([...keysOf("export"), ...keysOf("ui"), ...dialog.bare])
        );
      }
    });

    test("a row changes the dialog's config, not the live settings", async ({
      page,
    }) => {
      await openDialog(page, dialog.route);
      const before = await values(page, dialog, "stackCounts");
      await page
        .locator('.q-dialog [data-setting="ui:stackCounts"] .q-toggle')
        .click();
      await expect
        .poll(() => values(page, dialog, "stackCounts"))
        .toEqual({ own: !before.own, live: before.live });
      // Highlight Last Move too, which writes two keys
      const live = await page.evaluate(() => {
        const { highlightSquares, highlightPieces } =
          window.app.$store.state.ui;
        return { highlightSquares, highlightPieces };
      });
      const squares = await values(page, dialog, "highlightSquares");
      const pieces = await values(page, dialog, "highlightPieces");
      const unpressed = page.locator(
        '.q-dialog [data-setting="ui:highlightSquares"] .setting-buttons button[aria-pressed="false"]'
      );
      await unpressed.first().click();
      await expect
        .poll(async () => {
          const [s, p] = await Promise.all([
            values(page, dialog, "highlightSquares"),
            values(page, dialog, "highlightPieces"),
          ]);
          return s.own !== squares.own || p.own !== pieces.own;
        })
        .toBe(true);
      expect(
        await page.evaluate(() => {
          const { highlightSquares, highlightPieces } =
            window.app.$store.state.ui;
          return { highlightSquares, highlightPieces };
        })
      ).toEqual(live);
    });

    test("a row follows the dialog's value of the row it depends on", async ({
      page,
    }) => {
      await setLive(page, "unplayedPieces", true);
      await openDialog(page, dialog.route);
      const vertical = page.locator(
        '.q-dialog [data-setting="ui:verticalLayout"]'
      );
      await expect(vertical).not.toHaveClass(/disabled/);
      await page
        .locator('.q-dialog [data-setting="ui:unplayedPieces"] .q-toggle')
        .click();
      await expect(vertical).toHaveClass(/disabled/);
      await expect(vertical).toContainText("Requires Unplayed Pieces");
      // The GIF dialog stores its config a moment after a change
      await expect
        .poll(() => values(page, dialog, "unplayedPieces"))
        .toEqual({ own: false, live: true });
    });

    test("no row shows a hotkey, and Highlight Last Move is a row of buttons", async ({
      page,
    }) => {
      await openDialog(page, dialog.route);
      await expect(
        page.locator('.q-dialog [data-setting="ui:stackCounts"]')
      ).toBeVisible();
      await expect(page.locator(".q-dialog .setting-hotkey")).toHaveCount(0);
      await expect(
        page.locator(
          '.q-dialog [data-setting="ui:highlightSquares"] .setting-buttons button'
        )
      ).toHaveCount(3);
    });

    test("nothing is wider than the dialog at a phone's width", async ({
      page,
    }) => {
      await page.setViewportSize({ width: 375, height: 812 });
      await openDialog(page, dialog.route);
      await page.locator(".q-dialog .settings-sections").waitFor();
      const overflow = await page.evaluate(() => {
        const list = document.querySelector(
          ".q-dialog .settings-sections"
        ).parentElement;
        const { right } = list.getBoundingClientRect();
        return [...list.querySelectorAll(".setting-row, .q-item")]
          .filter((el) => el.getBoundingClientRect().right > right + 0.5)
          .map((el) => el.dataset.setting || el.className);
      });
      expect(overflow).toEqual([]);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth
        )
      ).toBe(true);
    });
  });
}

test.describe("rules of the dialogs' own", () => {
  test.beforeEach(async ({ page }) => {
    await openGame(page);
  });

  for (const route of ["image", "gif"]) {
    test(`${route}: the move number needs the turn indicator, and Player Names sits under it`, async ({
      page,
    }) => {
      await openDialog(page, route);
      const turn = page.locator('.q-dialog [data-setting="ui:turnIndicator"]');
      const move = page.locator('.q-dialog [data-setting="ui:moveNumber"]');
      expect(await childAfter(page, "ui:turnIndicator")).toBe(
        "export:includeNames"
      );
      await expect(move).not.toHaveClass(/disabled/);
      await turn.locator(".q-toggle").first().click();
      await expect(move).toHaveClass(/disabled/);
      await expect(move).toContainText("Requires Turn Indicator");
      // Evaluation text and the bar don't need their live parents here
      await expect(
        page.locator('.q-dialog [data-setting="ui:evalText"]')
      ).toContainText("Requires Turn Indicator");
      await expect(
        page.locator('.q-dialog [data-setting="ui:boardEvalBar"]')
      ).not.toHaveClass(/disabled/);
    });
  }

  test("gif: Delay Analysis sits under Visualize Suggestions", async ({
    page,
  }) => {
    await openDialog(page, "gif");
    expect(await childAfter(page, "ui:showAnalysisBoard")).toBe(
      "export:delayAnalysis"
    );
  });

  test("embed: Disable Navigation locks the navigation rows", async ({
    page,
  }) => {
    await openDialog(page, "embed");
    await toggle(page, "Disable Navigation");
    for (const id of [
      "ui:showControls",
      "ui:showPlayButton",
      "ui:playSpeed",
      "ui:showScrubber",
    ]) {
      const row = page.locator(`.q-dialog [data-setting="${id}"]`).first();
      await expect(row).toHaveClass(/disabled/);
      await expect(row).toContainText("Locked by Disable Navigation");
    }
  });
});

// Captured at de0af101, before the dialogs used the settings rows
const PINNED = {
  image: {
    config: {
      axisLabels: true,
      axisLabelsSmall: false,
      bgAlpha: 1,
      boardEvalBar: true,
      centerStackCounts: false,
      evalText: false,
      flatCounts: true,
      flatWinHighlights: true,
      highlightPieces: true,
      highlightSquares: false,
      imageSize: "md",
      includeNames: false,
      moveNumber: true,
      padding: false,
      showAnalysisBoard: true,
      showRoads: false,
      stackCounts: true,
      svgFormat: false,
      textSize: "md",
      themeID: "classic",
      turnIndicator: true,
      unplayedPieces: true,
      verticalLayout: false,
    },
    url: "fdffd2ce378dcab33a93c458d8adf245eeead95809a0a7153beeb4e0d7ccea18",
  },
  gif: {
    config: {
      axisLabels: true,
      axisLabelsSmall: true,
      boardEvalBar: true,
      centerStackCounts: false,
      delayAnalysis: true,
      evalText: true,
      flatCounts: true,
      flatWinHighlights: false,
      highlightPieces: false,
      highlightSquares: false,
      imageSize: "md",
      includeNames: false,
      moveNumber: true,
      padding: true,
      playSpeed: 60,
      plyRange: { max: 4, min: 0 },
      showAnalysisBoard: false,
      showRoads: true,
      stackCounts: true,
      textSize: "md",
      themeID: "classic",
      transparent: true,
      turnIndicator: true,
      unplayedPieces: true,
      verticalLayout: true,
    },
    url: "b6b0319ff07723e32db784b9202eab1afde993c8ff27f39f14041404796ec0e8",
  },
  embed: {
    config: {
      height: "600px",
      includeNames: true,
      state: true,
      ui: {
        axisLabels: true,
        axisLabelsSmall: true,
        boardEvalBar: true,
        centerStackCounts: false,
        disableBoard: false,
        disableNavigation: false,
        disablePTN: false,
        disablePTNTools: false,
        disableStoneCycling: false,
        disableText: true,
        disableUndo: false,
        evalText: true,
        flatCounts: true,
        flatWinHighlights: true,
        gameTimer: true,
        highlightPieces: true,
        highlightSquares: false,
        inlineBranches: true,
        moveNumber: false,
        notifyAnalysisNotes: false,
        notifyGame: true,
        notifyNotes: false,
        playSpeed: 120,
        showAllBranches: true,
        showAnalysisBoard: true,
        showBoardPrefsBtn: false,
        showBoardTransformBtn: true,
        showControls: true,
        showEval: true,
        showMove: true,
        showPTN: true,
        showPlayButton: false,
        // Partial Roads now start off; the link leaves the default out either way
        showRoads: false,
        showScrubber: true,
        showText: false,
        showToolbarAnalysis: true,
        stackCounts: false,
        themeID: "classic",
        turnIndicator: true,
        unplayedPieces: true,
        verticalLayout: true,
        verticalLayoutAuto: false,
      },
      width: "100%",
    },
    url: "dbd24510bb583e88213d23a31faa85eb2de270f2dcd1bb537bd8e9d24077c0e5",
    code: "155aa9199f96ad6eb807a0534baa0dc5dcba42d7a85434488d6dba1c98cff3cd",
  },
};
