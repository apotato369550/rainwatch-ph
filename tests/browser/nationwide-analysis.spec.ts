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

test("insights activate per exact point, load visible reports only, and reuse each report", async ({
  page,
}) => {
  const requests: {
    ceb: boolean;
    lat: number;
    context: {
      view: string;
      period: string;
      rows?: unknown[];
      climate?: { months: unknown[] };
    };
  }[] = [];
  await page.route("**/api/analysis", async (r) => {
    requests.push(r.request().postDataJSON());
    await r.fulfill({
      json: {
        analysis:
          "Overview.\n**Check drainage.**\n- Inspect the site.\n- <img src=x onerror=alert(1)>",
        model: "fixture",
        observedAt: "2026-11-01T00:00:00Z",
        generatedAt: "2026-11-01T01:00:00Z",
      },
    });
  });
  await page.goto("/");
  await expect(page.locator(".condition-card")).toHaveCount(4);
  expect(requests).toHaveLength(0);
  await page
    .getByRole("button", { name: "Enable AI insights", exact: true })
    .click();
  const active = page.locator(".dashboard-panel:not([hidden])");
  await expect(active.locator(".analysis-content strong")).toHaveText(
    "Check drainage.",
  );
  await expect(active.locator(".analysis-content li")).toHaveCount(2);
  await expect(active.locator(".analysis-content img")).toHaveCount(0);
  await expect(active.locator(".analysis-content")).toHaveCSS(
    "font-size",
    "14px",
  );
  await expect(active.locator(".analysis-provenance")).toContainText(
    "Generated",
  );
  expect(requests).toHaveLength(1);
  expect(requests[0].context.period).toBe("current");
  for (const [href, view, period] of [
    ["/conditions", "conditions", "hourly"],
    ["/environment", "environment", "climate"],
    ["/planning", "seasonal", "6"],
  ]) {
    await page.locator(`.page-nav a[href="${href}"]`).click();
    await expect(page).toHaveURL(new RegExp(href + "$"));
    const section =
      view === "environment"
        ? "growing"
        : view === "seasonal"
          ? "planning"
          : "conditions";
    const destination = page.locator(`[data-section="${section}"]`);
    await expect(destination).toBeVisible();
    await expect(destination.locator(".analysis-content")).toContainText(
      "Overview.",
    );
    expect(requests.at(-1)!.context.view).toBe(view);
    expect(requests.at(-1)!.context.period).toBe(period);
  }
  expect(requests).toHaveLength(4);
  expect(requests.at(-1)!.context.climate!.months).toHaveLength(6);
  await page
    .getByRole("button", { name: "Annual climate profile", exact: true })
    .click();
  await expect.poll(() => requests.length).toBe(5);
  await expect(active.locator(".analysis-content")).toContainText("Overview.");
  expect(requests.at(-1)!.context.climate!.months).toHaveLength(12);
  await page.getByRole("button", { name: "6 months", exact: true }).click();
  await expect(active.locator(".analysis-provenance")).toContainText(
    "Reused report",
  );
  expect(requests).toHaveLength(5);
  await page.locator('.page-nav a[href="/conditions"]').click();
  await expect(page).toHaveURL(/\/conditions$/);
  await expect(page.locator('[data-section="conditions"]')).toBeVisible();
  await expect(active.locator(".analysis-provenance")).toContainText(
    "Reused report",
  );
  await page.getByRole("switch", { name: "Hourly graphs" }).click();
  await page.getByRole("tab", { name: "Rainfall", exact: true }).click();
  await expect(active.locator(".analysis-content")).toContainText("Overview.");
  expect(requests).toHaveLength(5);
  await page.locator(".tanom-header .language").click();
  await expect.poll(() => requests.length).toBe(6);
  expect(requests.at(-1)!.ceb).toBe(true);
  await page.locator(".tanom-header .language").click();
  await expect(active.locator(".analysis-provenance")).toContainText(
    "Reused report",
  );
  expect(requests).toHaveLength(6);
  await page
    .getByLabel("Municipality / city", { exact: true })
    .selectOption({ label: "Argao" });
  await expect(
    page.getByRole("button", { name: "Enable AI insights", exact: true }),
  ).toBeVisible();
  await expect(active.locator(".analysis-content")).toHaveCount(0);
  expect(requests).toHaveLength(6);
  await page
    .getByRole("button", { name: "Enable AI insights", exact: true })
    .click();
  await expect.poll(() => requests.length).toBe(7);
});

for (const [status, code, message] of [
  [429, "AI_QUOTA_EXCEEDED", "request limit"],
  [429, "AI_INFLIGHT", "already in progress"],
  [429, "AI_BUSY", "already in progress"],
  [503, "AI_STORE_UNAVAILABLE", "temporarily unavailable"],
] as const) {
  test(`AI ${code} is explicit and does not automatically retry`, async ({
    page,
  }) => {
    let calls = 0;
    await page.route("**/api/analysis", (r) => {
      calls++;
      return r.fulfill({ status, json: { code } });
    });
    await page.goto("/");
    await page
      .getByRole("button", { name: "Enable AI insights", exact: true })
      .click();
    const active = page.locator(".dashboard-panel:not([hidden])");
    await expect(active.getByRole("alert")).toContainText(message);
    await page.locator('.page-nav a[href="/ml"]').click();
    await expect(page.locator('[data-section="ml"]')).toBeVisible();
    await page.locator('.page-nav a[href="/"]').click();
    await expect(page.locator('[data-section="home"]')).toBeVisible();
    await expect(active.getByRole("alert")).toContainText(message);
    expect(calls).toBe(1);
    await active.getByRole("button", { name: "Retry analysis" }).click();
    await expect.poll(() => calls).toBe(2);
  });
}

test("expired saved reports show snapshot metadata and refresh only on manual action", async ({
  page,
}) => {
  let calls = 0;
  await page.route("**/api/analysis", (r) => {
    calls++;
    return r.fulfill({
      json: {
        analysis: "Historical snapshot, not a live report.",
        model: "fixture",
        observedAt: "2026-01-01T00:00:00Z",
        contextFetchedAt: "2026-01-01T01:00:00Z",
        generatedAt: "2026-01-01T02:00:00Z",
        expiresAt: "2026-01-01T03:00:00Z",
        cached: true,
        ageSeconds: 86400,
      },
    });
  });
  await page.goto("/");
  await page
    .getByRole("button", { name: "Enable AI insights", exact: true })
    .click();
  const active = page.locator(".dashboard-panel:not([hidden])");
  await expect(active.locator(".analysis-freshness")).toContainText(
    "Expired report — not current",
  );
  await expect(active.locator(".analysis-provenance")).toContainText(
    "Reused report",
  );
  await expect(active.locator(".analysis-provenance")).toContainText(
    "Context retrieved",
  );
  await expect(active.locator(".analysis-provenance")).toContainText(
    "Data snapshot",
  );
  await expect(active.locator(".analysis-provenance")).not.toContainText(
    "Data observed",
  );
  await expect(active.locator(".analysis-freshness")).toContainText("Expires");
  await page.locator('.page-nav a[href="/ml"]').click();
  await expect(page.locator('[data-section="ml"]')).toBeVisible();
  await page.locator('.page-nav a[href="/"]').click();
  await expect(page.locator('[data-section="home"]')).toBeVisible();
  await expect(active.locator(".analysis-freshness")).toContainText(
    "Expired report",
  );
  expect(calls).toBe(1);
  await active.getByRole("button", { name: "Refresh AI report" }).click();
  await expect.poll(() => calls).toBe(2);
});
