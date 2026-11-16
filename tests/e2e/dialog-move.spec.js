// @ts-check
const { test, expect } = require("./helpers");

/**
 * Dialogs move by dragging their header, and open in the center again
 * every time: the position isn't kept.
 */

const openSettings = async (page) => {
  await page.evaluate(async () => {
    await window.app.$router.push("/settings/general").catch(() => {});
  });
  await expect(page.locator(".settings-dialog")).toBeVisible();
};
const closeSettings = async (page) => {
  await page.evaluate(async () => {
    await window.app.$router.push("/").catch(() => {});
  });
  await expect(page.locator(".settings-dialog")).toHaveCount(0);
};

test.describe("movable dialogs", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await closeSettings(page);
  });

  const box = (page) =>
    page.locator(".large-dialog .q-layout-container").first().boundingBox();
  const header = (page) => page.locator(".large-dialog .q-header").first();
  // Until the opening transition, which scales the dialog in, has finished:
  // the header measures the same twice running
  const settled = async (page) => {
    let last = null;
    await expect
      .poll(
        async () => {
          const b = await header(page).boundingBox();
          const same =
            !!b &&
            !!last &&
            b.width > 0 &&
            Math.abs(b.width - last.width) < 0.5 &&
            Math.abs(b.y - last.y) < 0.5;
          last = b;
          return same;
        },
        { intervals: [100] }
      )
      .toBe(true);
  };

  test("dragging the header moves the dialog, and it reopens centered", async ({
    page,
  }) => {
    await openSettings(page);
    await settled(page);
    const start = await box(page);
    const handle = await header(page).boundingBox();
    // The header's left part, away from its buttons
    const x = handle.x + 40;
    const y = handle.y + handle.height / 2;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x - 100, y + 60, { steps: 5 });
    await page.mouse.up();
    const moved = await box(page);
    expect(Math.round(moved.x - start.x)).toBe(-100);
    expect(Math.round(moved.y - start.y)).toBe(60);
    // Still open: the drag's click didn't reach anything
    await expect(page.locator(".settings-dialog")).toBeVisible();

    await closeSettings(page);
    await openSettings(page);
    await settled(page);
    const reopened = await box(page);
    expect(Math.round(reopened.x)).toBe(Math.round(start.x));
    expect(Math.round(reopened.y)).toBe(Math.round(start.y));
    await closeSettings(page);
  });

  test("a dragged dialog stays entirely on screen", async ({ page }) => {
    await openSettings(page);
    await settled(page);
    // Far past each edge in turn
    for (const [dx, dy] of [
      [0, -2000],
      [0, 2000],
      [-2000, 0],
      [2000, 0],
    ]) {
      const handle = await header(page).boundingBox();
      const x = handle.x + 40;
      const y = handle.y + handle.height / 2;
      await page.mouse.move(x, y);
      await page.mouse.down();
      await page.mouse.move(x + dx, y + dy, { steps: 5 });
      await page.mouse.up();
      const b = await box(page);
      const where = `after dragging by ${dx}, ${dy}`;
      expect(b.x, where).toBeGreaterThanOrEqual(-0.5);
      expect(b.y, where).toBeGreaterThanOrEqual(-0.5);
      expect(b.x + b.width, where).toBeLessThanOrEqual(1280 + 0.5);
      expect(b.y + b.height, where).toBeLessThanOrEqual(900 + 0.5);
      // Against the edge it was dragged toward
      if (dx < 0) expect(Math.round(b.x)).toBe(0);
      if (dx > 0) expect(Math.round(b.x + b.width)).toBe(1280);
      if (dy < 0) expect(Math.round(b.y)).toBe(0);
      if (dy > 0) expect(Math.round(b.y + b.height)).toBe(900);
    }
    await closeSettings(page);
  });

  test("a click on a header button still works", async ({ page }) => {
    await openSettings(page);
    // The close button, first in the header's reversed row of buttons
    await page
      .locator(".large-dialog .q-header .q-item__section--side .q-btn")
      .first()
      .click();
    await expect(page.locator(".settings-dialog")).toHaveCount(0);
  });

  test("a moved dialog that grows stays on screen", async ({ page }) => {
    await page.evaluate(async () => {
      await window.app.$router.push("/info/edit").catch(() => {});
    });
    const dialog = page.locator(".large-dialog .q-layout-container").first();
    await expect(dialog).toBeVisible();
    await settled(page);
    // Up against the top of the window
    const handle = await header(page).boundingBox();
    const x = handle.x + 40;
    const y = handle.y + handle.height / 2;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x, 0, { steps: 5 });
    await page.mouse.up();
    expect(Math.round((await dialog.boundingBox()).y)).toBe(0);

    // More makes it taller, growing up as well as down from the center
    const before = (await dialog.boundingBox()).height;
    await page
      .locator(".large-dialog .q-footer .q-btn", { hasText: "More" })
      .click();
    await expect
      .poll(async () => (await dialog.boundingBox()).height)
      .toBeGreaterThan(before + 100);
    // After its height has eased to the new one
    await page.waitForTimeout(600);
    const after = await dialog.boundingBox();
    expect(after.y).toBeGreaterThanOrEqual(0);
    expect(after.y + after.height).toBeLessThanOrEqual(900 + 0.5);
    expect((await header(page).boundingBox()).y).toBeGreaterThanOrEqual(0);

    await page.evaluate(async () => {
      await window.app.$router.push("/").catch(() => {});
    });
    await expect(page.locator(".large-dialog")).toHaveCount(0);
  });

  test("a maximized dialog doesn't move", async ({ page }) => {
    await page.setViewportSize({ width: 400, height: 700 });
    await page.waitForFunction(() => window.app.$q.screen.width === 400);
    await openSettings(page);
    await settled(page);
    const start = await box(page);
    const handle = await header(page).boundingBox();
    const x = handle.x + 40;
    const y = handle.y + handle.height / 2;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x + 80, y + 80, { steps: 5 });
    await page.mouse.up();
    expect(await box(page)).toEqual(start);
    await closeSettings(page);
  });

  test.describe("maximize", () => {
    const maximize = (page) =>
      page.locator(".large-dialog .q-header .dialog-maximize").first();
    const forget = (page) =>
      page.evaluate(() =>
        window.localStorage.removeItem("dialogMaximized:Settings")
      );
    test.afterEach(async ({ page }) => {
      await closeSettings(page);
      await forget(page);
    });

    test("the header button fills the screen's height, and restores", async ({
      page,
    }) => {
      await forget(page);
      await openSettings(page);
      await settled(page);
      const normal = await box(page);
      expect(normal.width).toBeLessThan(1280);

      await maximize(page).click();
      // No wider than 800px, in the middle
      await expect
        .poll(async () => {
          const b = await box(page);
          return [b.x, b.y, b.width, b.height].map(Math.round);
        })
        .toEqual([240, 0, 800, 900]);
      await expect(maximize(page).locator(".mdi-fullscreen-exit")).toHaveCount(
        1
      );

      // A maximized dialog doesn't move
      const handle = await header(page).boundingBox();
      await page.mouse.move(handle.x + 40, handle.y + handle.height / 2);
      await page.mouse.down();
      await page.mouse.move(handle.x + 140, handle.y + 100, { steps: 5 });
      await page.mouse.up();
      expect(Math.round((await box(page)).x)).toBe(240);

      await maximize(page).click();
      await expect
        .poll(async () => Math.round((await box(page)).width))
        .toBe(Math.round(normal.width));
      await expect(maximize(page).locator(".mdi-fullscreen")).toHaveCount(1);
    });

    test("the choice is kept for that dialog", async ({ page }) => {
      await forget(page);
      await openSettings(page);
      await settled(page);
      await maximize(page).click();
      await closeSettings(page);

      await openSettings(page);
      await expect
        .poll(async () => Math.round((await box(page)).height))
        .toBe(900);
      // Pressed again, it goes back to following the screen
      await maximize(page).click();
      expect(
        await page.evaluate(() =>
          window.localStorage.getItem("dialogMaximized:Settings")
        )
      ).toBeNull();
    });

    test("a small dialog maximizes to the same width", async ({ page }) => {
      await page.evaluate(() =>
        window.localStorage.removeItem("dialogMaximized:GameInfo")
      );
      await page.evaluate(async () => {
        await window.app.$router.push("/info").catch(() => {});
      });
      const content = page.locator(".small-dialog .dialog-content").first();
      await expect(content).toBeVisible();
      await page.waitForTimeout(500);
      await page
        .locator(".small-dialog header .dialog-maximize")
        .first()
        .click();
      await expect
        .poll(async () => {
          const b = await content.boundingBox();
          return [b.x, b.y, b.width, b.height].map(Math.round);
        })
        .toEqual([240, 0, 800, 900]);
      await page.evaluate(async () => {
        window.localStorage.removeItem("dialogMaximized:GameInfo");
        await window.app.$router.push("/").catch(() => {});
      });
      await expect(page.locator(".small-dialog")).toHaveCount(0);
    });

    test("maximized Settings keeps its column separator to the bottom", async ({
      page,
    }) => {
      await forget(page);
      // A short page, so the columns are stretched to fill the dialog
      await page.evaluate(async () => {
        await window.app.$router
          .push("/settings/notifications")
          .catch(() => {});
      });
      await settled(page);
      const separator = page.locator(".settings-columns-separator");
      const reachesBottom = async () => {
        const [line, dialog] = await Promise.all([
          separator.boundingBox(),
          box(page),
        ]);
        return Math.round(dialog.y + dialog.height - (line.y + line.height));
      };
      expect(await reachesBottom()).toBe(0);
      await maximize(page).click();
      await expect
        .poll(async () => Math.round((await box(page)).height))
        .toBe(900);
      await expect.poll(reachesBottom).toBe(0);
      await maximize(page).click();
      await expect
        .poll(async () => Math.round((await box(page)).height))
        .toBe(700);
      await expect.poll(reachesBottom).toBe(0);
    });

    for (const [path, key] of [
      ["/embed", "EmbedConfig"],
      ["/image", "PNGConfig"],
      ["/gif", "GIFConfig"],
    ]) {
      test(`${key}, wider than 800px, isn't narrowed by maximizing`, async ({
        page,
      }) => {
        const forgetKey = () =>
          page.evaluate(
            (key) => window.localStorage.removeItem("dialogMaximized:" + key),
            key
          );
        await forgetKey();
        await page.evaluate(async (path) => {
          await window.app.$router.push(path).catch(() => {});
        }, path);
        await settled(page);
        const normal = await box(page);
        expect(Math.round(normal.width)).toBe(1100);
        await maximize(page).click();
        await expect
          .poll(async () => {
            const b = await box(page);
            return [b.x, b.y, b.width, b.height].map(Math.round);
          })
          .toEqual([90, 0, 1100, 900]);
        await maximize(page).click();
        await page.evaluate(async () => {
          await window.app.$router.push("/").catch(() => {});
        });
        await expect(page.locator(".large-dialog")).toHaveCount(0);
        await forgetKey();
      });
    }

    test("on a small screen it un-maximizes", async ({ page }) => {
      await forget(page);
      await page.setViewportSize({ width: 400, height: 700 });
      // Quasar takes the new size after a moment; opened before, the dialog
      // wouldn't be maximized on its own
      await page.waitForFunction(() => window.app.$q.screen.width === 400);
      await openSettings(page);
      await settled(page);
      // Maximized on its own here
      expect(Math.round((await box(page)).width)).toBe(400);
      await maximize(page).click();
      await expect
        .poll(async () => Math.round((await box(page)).height))
        .toBeLessThan(700);
    });
  });

  test.describe("fit to content", () => {
    // Edit Game's height, and how far its form scrolls
    const measure = (page) =>
      page.evaluate(() => {
        const layout = document.querySelector(
          ".large-dialog .q-layout-container"
        );
        let scroller = layout.querySelector(".q-page-container");
        while (
          scroller &&
          !/(auto|scroll)/.test(getComputedStyle(scroller).overflowY)
        ) {
          scroller = scroller.parentElement;
        }
        return {
          height: Math.round(layout.getBoundingClientRect().height),
          overflow: scroller.scrollHeight - scroller.clientHeight,
        };
      });
    const openEditGame = async (page) => {
      await page.evaluate(async () => {
        await window.app.$router.push("/info/edit").catch(() => {});
      });
      await settled(page);
    };
    const toggleMore = (page, label) =>
      page
        .locator(".large-dialog .q-footer .q-btn", { hasText: label })
        .click();
    test.afterEach(async ({ page }) => {
      await page.evaluate(async () => {
        await window.app.$router.push("/").catch(() => {});
      });
      await expect(page.locator(".large-dialog")).toHaveCount(0);
    });

    test("Edit Game shows its whole form, with More and without", async ({
      page,
    }) => {
      await page.setViewportSize({ width: 1280, height: 1100 });
      await openEditGame(page);
      const less = await measure(page);
      expect(less.overflow).toBe(0);

      await toggleMore(page, "More");
      await expect.poll(async () => (await measure(page)).overflow).toBe(0);
      await expect
        .poll(async () => (await measure(page)).height)
        .toBeGreaterThan(less.height + 100);

      await toggleMore(page, "Less");
      await expect
        .poll(async () => (await measure(page)).height)
        .toBe(less.height);
      expect((await measure(page)).overflow).toBe(0);
    });

    test("on a short screen, Edit Game fits the screen and scrolls", async ({
      page,
    }) => {
      await page.setViewportSize({ width: 1280, height: 700 });
      await openEditGame(page);
      await toggleMore(page, "More");
      await expect.poll(async () => (await measure(page)).height).toBe(700);
      expect((await measure(page)).overflow).toBeGreaterThan(0);
    });
  });
});
