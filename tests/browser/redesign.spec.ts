import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { forecastFixture, type Scenario } from "./fixtures";

for (const scenario of ["dry", "heavy", "missing"] as Scenario[]) {
  test(`${scenario}: readable responsive observatory`, async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.route("**/api/weather?*", (route) =>
      route.fulfill({
        json: forecastFixture(
          scenario,
          new URL(route.request().url()).searchParams.get("location") ?? "cebu",
        ),
      }),
    );
    await page.setViewportSize({ width: 1440, height: 1100 });
    await page.goto("/");
    await expect(
      page.getByRole("heading", { name: "Hourly rainfall forecast" }),
    ).toBeVisible();
    await expect(page.locator(".city-marker")).toHaveCount(10);
    await page.evaluate(() => document.fonts.ready);
    expect(
      await page.evaluate(() => getComputedStyle(document.body).fontFamily),
    ).toContain("plex");
    expect(
      await page.evaluate(() =>
        Array.from(document.fonts).some(
          (font) => font.family === "plex" && font.status === "loaded",
        ),
      ),
    ).toBe(true);
    if (scenario === "dry")
      await expect(page.locator(".peak-callout")).toContainText(
        "No rainfall forecast",
      );
    if (scenario === "heavy")
      await expect(page.locator(".level")).toHaveText("Extreme");
    if (scenario === "missing")
      await expect(page.locator(".warning")).toContainText(
        "Incomplete indicator",
      );
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    expect(results.violations).toEqual([]);
    for (const width of [1440, 768, 390, 320, 720]) {
      await page.setViewportSize({ width, height: 1100 });
      await expect
        .poll(
          () =>
            page.evaluate(() => ({
              width: window.innerWidth,
              overflow:
                document.documentElement.scrollWidth - window.innerWidth,
            })),
          { message: `No horizontal overflow at ${width}px` },
        )
        .toEqual({ width, overflow: 0 });
      const textSizes = await page
        .locator(
          "main p, main h2, main h3, main h4, .severity-scale span, .chart-legend, .leaflet-control-attribution",
        )
        .evaluateAll((nodes) =>
          nodes.map((node) => parseFloat(getComputedStyle(node).fontSize)),
        );
      expect(Math.min(...textSizes)).toBeGreaterThanOrEqual(12);
      if ([1440, 768, 390].includes(width))
        await page.screenshot({
          path: `test-results/observatory-${scenario}-${width}.png`,
          fullPage: true,
        });
      if (width === 390)
        expect(
          (
            await new AxeBuilder({ page })
              .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
              .analyze()
          ).violations,
        ).toEqual([]);
    }
    // 720 CSS px is the layout viewport of a 1440px display at 200% browser zoom.
    await page.getByLabel("Select city").focus();
    await expect(page.getByLabel("Select city")).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(
      page.getByRole("button", { name: "Refresh weather" }),
    ).toBeFocused();
    await page.getByText("How is this calculated?", { exact: false }).click();
    await expect(
      page.getByText("6h rain / 50 mm × 35", { exact: true }),
    ).toBeVisible();
    await page.getByText("View hourly data", { exact: true }).click();
    await expect(page.locator("tbody tr")).toHaveCount(24);
    expect(errors).toEqual([]);
  });
}
test("stale and failed updates keep readable recovery controls", async ({
  page,
}) => {
  let fail = false;
  await page.route("**/api/weather?*", (route) =>
    fail
      ? route.fulfill({
          status: 502,
          json: { error: "Live weather is temporarily unavailable." },
        })
      : route.fulfill({ json: forecastFixture("heavy") }),
  );
  await page.goto("/");
  await expect(page.locator(".update-status")).toContainText("Fetched");
  fail = true;
  await page.getByRole("button", { name: "Refresh weather" }).click();
  await expect(page.locator(".error")).toContainText("may be stale");
  await expect(
    page.getByRole("heading", { name: "Hourly rainfall forecast" }),
  ).toBeVisible();
  expect(
    (await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze())
      .violations,
  ).toEqual([]);
  await page.screenshot({
    path: "test-results/observatory-stale.png",
    fullPage: true,
  });
  await page.reload();
  await expect(page.locator(".error")).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Hourly rainfall forecast" }),
  ).toHaveCount(0);
  await page.screenshot({
    path: "test-results/observatory-outage.png",
    fullPage: true,
  });
  fail = false;
  await page.getByRole("button", { name: "Try again" }).click();
  await expect(
    page.getByRole("heading", { name: "Hourly rainfall forecast" }),
  ).toBeVisible();
});
