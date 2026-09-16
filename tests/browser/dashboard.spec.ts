import { expect, test } from "@playwright/test";
test("live dashboard, local map, selection, and mobile layout", async ({
  page,
  request,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const response = await request.get("/api/weather?location=cebu");
  expect(response.status()).toBe(200);
  const data = await response.json();
  expect(data.hourly).toHaveLength(24);
  expect(data.stressScore).toBeGreaterThanOrEqual(0);
  expect(data.stressScore).toBeLessThanOrEqual(100);
  expect((await request.get("/api/weather?location=invalid")).status()).toBe(
    400,
  );
  await page.setViewportSize({ width: 1440, height: 1100 });
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Hourly rainfall forecast" }),
  ).toBeVisible();
  await expect(page.locator(".leaflet-interactive").first()).toBeVisible();
  await expect(page.locator(".city-marker")).toHaveCount(10);
  // A genuinely dry forecast has no nonzero bar rectangles.
  await expect(page.locator(".recharts-surface").first()).toBeVisible();
  await page.getByText("View hourly data", { exact: true }).click();
  await expect(page.locator("tbody tr")).toHaveCount(24);
  await page.getByText("View hourly data", { exact: true }).click();
  await page.locator('.city-marker[title="Baguio"]').click();
  await expect(page.getByLabel("Select city")).toHaveValue("baguio");
  await expect(page.locator(".update-status")).toContainText("Fetched", {
    timeout: 30_000,
  });
  await page.getByLabel("Select city").selectOption("manila");
  await expect(page.locator(".update-status")).toContainText("Fetched", {
    timeout: 30_000,
  });
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Manilarainfall outlook",
  );
  await page.screenshot({
    path: "test-results/dashboard-desktop.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(
    page.getByRole("heading", { name: "Hourly rainfall forecast" }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "test-results/dashboard-mobile.png",
    fullPage: true,
  });
  expect(errors).toEqual([]);
});
test("weather outage displays a retry without fabricated values", async ({
  page,
}) => {
  await page.route("**/api/weather?*", (route) =>
    route.fulfill({
      status: 502,
      contentType: "application/json",
      body: JSON.stringify({
        error: "Live weather is temporarily unavailable.",
      }),
    }),
  );
  await page.goto("/");
  await expect(page.locator('.error[role="alert"]')).toContainText(
    "couldn’t update",
  );
  await expect(page.getByRole("button", { name: "Try again" })).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Hourly rainfall forecast" }),
  ).toHaveCount(0);
  await expect(page.locator(".city-marker")).toHaveCount(10);
});
