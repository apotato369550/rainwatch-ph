import { expect, test } from "@playwright/test";
import { environmentFixture, climateFixture } from "./tanom-fixtures";
test("Environment redirects, shows tolerance cards and generates analysis on demand", async ({
  page,
}) => {
  await page.route("**/api/environment?*", (r) =>
    r.fulfill({ json: environmentFixture() }),
  );
  await page.route("**/api/climate-profile?*", (r) =>
    r.fulfill({ json: climateFixture }),
  );
  let calls = 0;
  await page.route("**/api/analysis", (r) => {
    calls++;
    return r.fulfill({
      json: {
        analysis:
          "Modeled conditions.\n\n- Check drainage.\n- Inspect the site.",
        model: "fixture",
        observedAt: "2026-01-01",
      },
    });
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/growing");
  await expect(page).toHaveURL(/\/environment$/);
  await expect(
    page.getByRole("heading", { name: "Environment", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".crop-card").first()).toBeVisible();
  const crops = page.getByRole("region", { name: "Crops to Explore" });
  await expect(crops).toHaveClass("tanom-panel cropsection");
  await expect(crops.locator(".crop-title-card p")).toHaveText(
    "Explore crops based on this location’s climate and elevation, and compare their growing needs.",
  );
  await expect(crops).toHaveCSS("background-color", "rgb(255, 253, 247)");
  for (const card of await crops.locator(".crop-card").all()) {
    const background = await card.evaluate((el) => {
      const style = getComputedStyle(el);
      const probe = document.createElement("div");
      probe.style.backgroundColor = style.getPropertyValue("--crop-bg");
      el.appendChild(probe);
      const expected = getComputedStyle(probe).backgroundColor;
      probe.remove();
      return { actual: style.backgroundColor, expected };
    });
    expect(background.actual).toBe(background.expected);
    expect(background.actual).not.toBe("rgb(255, 253, 247)");
  }
  expect(await page.locator(".crop-card").count()).toBeGreaterThanOrEqual(2);
  expect(await page.locator(".crop-card").count()).toBeLessThanOrEqual(7);
  await expect(page.locator(".crop-card").first()).toContainText(
    "View Crop Info",
  );
  expect(calls).toBe(0);
  await page
    .getByRole("button", { name: "Enable AI insights", exact: true })
    .click();
  await expect(page.locator(".analysis-content li")).toHaveCount(2);
  expect(calls).toBe(1);
  for (const width of [768, 390, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
});

for (const count of [0, 7])
  test(
    "Environment balanced layout and long analysis with " + count + " crops",
    async ({ page }) => {
      await page.route("**/api/environment?*", (r) =>
        r.fulfill({ json: environmentFixture() }),
      );
      await page.route("**/api/climate-profile?*", (r) =>
        r.fulfill({
          json:
            count === 0
              ? {
                  ...climateFixture,
                  months: climateFixture.months.map((m) => ({
                    ...m,
                    heat: 60,
                  })),
                }
              : climateFixture,
        }),
      );
      await page.route("**/api/analysis", (r) =>
        r.fulfill({
          json: {
            analysis: Array.from(
              { length: 30 },
              () => "Modeled conditions need field verification.",
            ).join("\n\n"),
            model: "fixture",
            observedAt: "2026-01-01",
          },
        }),
      );
      await page.setViewportSize({ width: 1920, height: 1200 });
      await page.goto("/environment");
      if (count === 0) {
        await expect(page.locator(".cropsection")).toContainText(
          "No catalog crops meet",
        );
        await expect(page.locator(".crop-card")).toHaveCount(0);
      } else {
        await expect(page.locator(".crop-card").first()).toBeVisible();
        expect(await page.locator(".crop-card").count()).toBeLessThanOrEqual(7);
      }
      await expect(page.locator(".dashboard-layout")).toHaveCSS(
        "display",
        "grid",
      );
      await expect(page.locator(".leaflet-container")).toBeVisible();
      const picker = await page.locator(".map-panel").boundingBox();
      const cropPanel = await page.locator(".cropsection").boundingBox();
      const analysisPanel = await page
        .locator(".environment-panel .analysis-panel")
        .boundingBox();
      expect(picker!.x).toBeGreaterThanOrEqual(cropPanel!.x + cropPanel!.width);
      expect(cropPanel!.x).toBe(analysisPanel!.x);
      expect(analysisPanel!.y).toBeGreaterThanOrEqual(
        cropPanel!.y + cropPanel!.height + 24,
      );
      await expect(page.locator(".crop-title-card")).not.toContainText(
        "GROW WITH",
      );
      await page
        .getByRole("button", { name: "Enable AI insights", exact: true })
        .click();
      await expect(page.locator(".analysis-content p")).toHaveCount(30);
      const output = page.getByRole("region", { name: "Generated analysis" });
      await expect(output).toHaveAttribute("tabindex", "0");
      expect(
        await output.evaluate((el) => el.scrollHeight >= el.clientHeight),
      ).toBe(true);
      const after = await page.locator(".map-panel").boundingBox();
      expect(after!.height).toBe(picker!.height);
      for (const width of [768, 390]) {
        await page.setViewportSize({ width, height: 1000 });
        const map = await page.locator(".dashboard-location").boundingBox();
        const analysis = await page
          .locator(".environment-panel .analysis-panel")
          .boundingBox();
        expect(analysis!.y).toBeGreaterThanOrEqual(map!.y + map!.height);
        expect(
          await output.evaluate((el) => el.scrollHeight <= el.clientHeight + 1),
        ).toBe(true);
      }
    },
  );

test("crop carousel has nonwrapping controls, keyboard navigation and reduced-motion snap", async ({
  page,
}) => {
  await page.route("**/api/environment?*", (r) =>
    r.fulfill({ json: environmentFixture() }),
  );
  await page.route("**/api/climate-profile?*", (r) =>
    r.fulfill({ json: climateFixture }),
  );
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/environment");
  const carousel = page.getByRole("region", {
    name: "Qualifying crop matches",
  });
  await expect(carousel).toBeVisible();
  const count = await carousel.locator(".crop-card").count();
  expect(count).toBeGreaterThan(1);
  expect(count).toBeLessThanOrEqual(7);
  await expect(carousel.locator(".crop-alternative")).toHaveCount(0);
  await expect(
    carousel.getByRole("button", { name: "Previous crop" }),
  ).toBeDisabled();
  const track = carousel.locator(".crop-carousel-track");
  await expect(track).toHaveCSS("scroll-snap-type", "x mandatory");
  await track.focus();
  await page.keyboard.press("End");
  await expect(carousel.getByRole("status")).toHaveText(
    `Crop ${count} of ${count}`,
  );
  await expect(
    carousel.getByRole("button", { name: "Next crop" }),
  ).toBeDisabled();
  await page.keyboard.press("ArrowRight");
  await expect(carousel.getByRole("status")).toHaveText(
    `Crop ${count} of ${count}`,
  );
  await page.keyboard.press("Home");
  await carousel.getByRole("button", { name: "Next crop" }).click();
  await expect(carousel.getByRole("status")).toHaveText(`Crop 2 of ${count}`);
  // Native touch/trackpad scrolling updates the same accessible counter.
  await track.evaluate((el) => el.scrollTo({ left: 0, behavior: "instant" }));
  await expect(carousel.getByRole("status")).toHaveText(`Crop 1 of ${count}`);
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
});
