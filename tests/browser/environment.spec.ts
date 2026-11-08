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
  expect(await page.locator(".crop-card").count()).toBeLessThanOrEqual(3);
  await expect(page.locator(".crop-card").first()).toContainText(
    "View Crop Info",
  );
  expect(calls).toBe(0);
  await page
    .getByRole("button", { name: "Generate analysis", exact: true })
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

for (const count of [2, 3])
  test(
    "Environment balanced layout and long analysis with " + count + " crops",
    async ({ page }) => {
      await page.route("**/api/environment?*", (r) =>
        r.fulfill({ json: environmentFixture() }),
      );
      await page.route("**/api/climate-profile?*", (r) =>
        r.fulfill({
          json:
            count === 2
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
      await expect(page.locator(".crop-card")).toHaveCount(count);
      await expect(page.locator(".environment-layout")).toHaveCSS(
        "display",
        "grid",
      );
      const picker = await page.locator(".map-panel").boundingBox();
      const cropPanel = await page.locator(".cropsection").boundingBox();
      const analysisPanel = await page.locator(".analysis-panel").boundingBox();
      expect(picker!.x).toBeGreaterThanOrEqual(cropPanel!.x + cropPanel!.width);
      expect(cropPanel!.x).toBe(analysisPanel!.x);
      expect(cropPanel!.y).toBeGreaterThanOrEqual(
        analysisPanel!.y + analysisPanel!.height,
      );
      await expect(page.locator(".crop-title-card")).not.toContainText(
        "GROW WITH",
      );
      await page
        .getByRole("button", { name: "Generate analysis", exact: true })
        .click();
      await expect(page.locator(".analysis-content p")).toHaveCount(30);
      const output = page.getByRole("region", { name: "Generated analysis" });
      await expect(output).toHaveAttribute("tabindex", "0");
      expect(
        await output.evaluate((el) => el.scrollHeight > el.clientHeight),
      ).toBe(true);
      const after = await page.locator(".map-panel").boundingBox();
      expect(after!.height).toBe(picker!.height);
      for (const width of [768, 390]) {
        await page.setViewportSize({ width, height: 1000 });
        const map = await page.locator(".environment-location").boundingBox();
        const analysis = await page.locator(".analysis-panel").boundingBox();
        expect(analysis!.y).toBeGreaterThanOrEqual(map!.y + map!.height);
        expect(
          await output.evaluate((el) => el.scrollHeight <= el.clientHeight + 1),
        ).toBe(true);
      }
    },
  );
