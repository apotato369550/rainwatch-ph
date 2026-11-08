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
      await expect(page.locator(".environment-layout")).toHaveAttribute(
        "data-fit",
        "true",
      );
      const picker = await page.locator(".map-panel").boundingBox();
      const layout = await page.locator(".environment-layout").boundingBox();
      expect(Math.abs(picker!.height - layout!.height)).toBeLessThan(2);
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
