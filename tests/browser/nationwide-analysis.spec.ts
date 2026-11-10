import { expect, test } from "@playwright/test";
import {
  environmentFixture,
  climateFixture,
  outlookFixture,
} from "./tanom-fixtures";

test.beforeEach(async ({ page }) => {
  await page.route("**/api/environment?*", (r) =>
    r.fulfill({ json: environmentFixture() }),
  );
  await page.route("**/api/climate-profile?*", (r) =>
    r.fulfill({ json: climateFixture }),
  );
  await page.route("**/api/outlook?*", (r) =>
    r.fulfill({ json: outlookFixture }),
  );
});
test("province filters without changing location; national municipality and GPS sync pickers", async ({
  page,
}) => {
  await page.goto("/");
  const location = page.locator(".location-heading h2");
  await expect(location).toHaveText("Dalaguete");
  await page
    .getByLabel("Province / area", { exact: true })
    .selectOption({ label: "Batanes" });
  await expect(location).toHaveText("Dalaguete");
  const cities = page.getByLabel("Municipality / city", { exact: true });
  await cities.selectOption({ label: "Basco" });
  await expect(location).toHaveText("Basco");
  await page
    .getByLabel("Province / area", { exact: true })
    .selectOption({ label: "NCR, City of Manila, First District" });
  await cities.selectOption({ index: 1 });
  await expect(location).not.toHaveText("Basco");
  await page.evaluate(() =>
    Object.defineProperty(navigator, "geolocation", {
      configurable: true,
      value: {
        getCurrentPosition: (ok: (value: unknown) => void) =>
          ok({
            coords: { latitude: 10.3157, longitude: 123.8854, accuracy: 20 },
          }),
      },
    }),
  );
  await page
    .getByRole("button", { name: "Use my location", exact: true })
    .click();
  await expect(location).toHaveText("Cebu City");
  await expect(
    page
      .getByLabel("Province / area", { exact: true })
      .locator("option:checked"),
  ).toHaveText("Cebu");
});

test("each view sends only its displayed snapshot; period changes invalidate its AI result", async ({
  page,
}) => {
  const requests: {
    context: {
      view: string;
      period: string;
      variable?: string;
      rows?: unknown[];
      climate?: { months: unknown[] };
    };
  }[] = [];
  await page.route("**/api/analysis", async (r) => {
    requests.push(r.request().postDataJSON());
    await r.fulfill({
      json: {
        analysis: "Snapshot analysis.",
        model: "fixture",
        observedAt: "2026-11-01T00:00:00Z",
      },
    });
  });
  await page.goto("/");
  const active = page.locator(".dashboard-panel:not([hidden])");
  for (const [href, view, period] of [
    ["/", "dashboard", "current"],
    ["/conditions", "conditions", "daily"],
    ["/environment", "environment", "climate"],
    ["/planning", "seasonal", "6"],
  ]) {
    if (href !== "/") await page.locator(`.page-nav a[href="${href}"]`).click();
    const section =
      view === "dashboard"
        ? "home"
        : view === "environment"
          ? "growing"
          : view === "seasonal"
            ? "planning"
            : "conditions";
    await expect(page.locator(`[data-section="${section}"]`)).toBeVisible();
    if (view === "environment")
      await expect(page.locator(".crop-card").first()).toBeVisible();
    await active
      .getByRole("button", { name: "Generate analysis", exact: true })
      .click();
    await expect(
      active.getByRole("region", { name: "Generated analysis" }),
    ).toContainText("Snapshot analysis.");
    expect(requests.at(-1)!.context.view).toBe(view);
    expect(requests.at(-1)!.context.period).toBe(period);
  }
  expect(requests.at(-1)!.context.climate!.months).toHaveLength(6);
  await page
    .getByRole("button", { name: "Annual climate profile", exact: true })
    .click();
  await expect(
    active.getByRole("region", { name: "Generated analysis" }),
  ).not.toContainText("Snapshot analysis.");
  await active
    .getByRole("button", { name: "Generate analysis", exact: true })
    .click();
  await expect.poll(() => requests.at(-1)!.context.period).toBe("annual");
  expect(requests.at(-1)!.context.climate!.months).toHaveLength(12);
  await page.locator('.page-nav a[href="/conditions"]').click();
  await expect(page.locator('[data-section="conditions"]')).toBeVisible();
  await expect(
    active.getByRole("region", { name: "Generated analysis" }),
  ).toContainText("Snapshot analysis.");
  await page.getByRole("switch", { name: "Hourly graphs" }).click();
  await expect(
    active.getByRole("region", { name: "Generated analysis" }),
  ).not.toContainText("Snapshot analysis.");
});
