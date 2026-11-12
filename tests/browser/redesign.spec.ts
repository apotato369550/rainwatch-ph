import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
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
test("TANOM live-data layout, map, matching, language, planning and accessible responsive states", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Dalaguete", exact: true }),
  ).toBeVisible();
  await expect(
    page.locator(".cebu-map .leaflet-interactive:visible").first(),
  ).toBeVisible();
  await expect(page.locator(".condition-card")).toHaveCount(4);
  await expect(page.locator(".tanom-header .language")).toHaveAttribute(
    "aria-checked",
    "false",
  );
  await page.goto("/environment");
  await page
    .getByRole("heading", { name: "Crops to Explore" })
    .scrollIntoViewIfNeeded();
  await expect(page.locator(".crop-card").first()).toBeVisible();
  await page.goto("/planning");
  const planning = page.locator('[data-section="planning"]');
  await expect(planning).toContainText(
    "Explore the next six months or typical yearly weather to help plan planting and farm activities.",
  );
  await expect(planning.locator(".eyeline")).toHaveCount(0);
  await expect(planning.locator(".limitations")).toHaveCount(0);

  await page
    .getByRole("button", { name: "Annual climate profile", exact: true })
    .click();
  await expect(page.locator(".seasonal-graphs .condition-graph")).toHaveCount(2);
  await expect(page.locator(".season-tabs button")).toHaveCount(2);
  await expect(page.locator(".monthly-summaries")).toHaveCount(0);
  await page.getByRole("button", { name: "6 months", exact: true }).click();
  await expect(page.getByRole("button", {name:"6 months",exact:true})).toHaveAttribute("aria-pressed","true");
  await page.goto("/");
  await page.locator(".tanom-header .language").click();
  await expect(page.locator("html")).toHaveAttribute("lang", "ceb");
  await expect(page.locator(".heat .card-label")).toContainText("Kainit");
  await page.locator(".tanom-header .language").click();
  await page
    .getByLabel("Municipality / city", { exact: true })
    .selectOption({ label: "City of Bogo" });
  await expect(page.locator(".location-heading h2")).toHaveText("City of Bogo");
  await page
    .getByLabel("Municipality / city", { exact: true })
    .selectOption({ label: "Dalaguete" });
  await page.evaluate(() => document.fonts.ready);
  for (const width of [1440, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    const axe = await new AxeBuilder({ page }).analyze();
    expect(axe.violations).toEqual([]);
    await page.screenshot({
      path: `test-results/tanom-${width}.png`,
      fullPage: true,
    });
  }
  expect(errors).toEqual([]);
});
for (const [name, code] of [
  ["cloudy", 3],
  ["rain", 61],
  ["storm", 95],
] as const) {
  test(
    name + " conditions and missing soil do not become zero",
    async ({ page }) => {
      await page.route("**/api/environment?*", (r) =>
        r.fulfill({ json: environmentFixture(code, true) }),
      );
      await page.goto("/");
      await expect(page.locator(".soil .card-value")).toContainText(
        "Unavailable",
      );
      await expect(page.locator(".heat h3")).toHaveText(
        code === 3 ? "Cloudy" : code === 61 ? "Rainfall" : "Thunderstorm",
      );
    },
  );
}
test("weather and seasonal failures show retry without fabricated guidance", async ({
  page,
}) => {
  await page.route("**/api/environment?*", (r) =>
    r.fulfill({ status: 502, json: { error: "Unavailable" } }),
  );
  await page.route("**/api/outlook?*", (r) =>
    r.fulfill({ status: 502, json: { error: "Unavailable" } }),
  );
  await page.goto("/");
  await expect(page.getByRole("alert").first()).toContainText(
    "Weather is unavailable",
  );
  await expect(page.locator(".heat .card-value")).toContainText("Unavailable");
  await page.goto("/planning");
  await page.locator(".season").scrollIntoViewIfNeeded();
  await expect(
    page.getByText(
      "Planning data is unavailable. Current weather is unaffected.",
    ),
  ).toBeVisible();
});
test("GPS rejection leaves manual selection usable", async ({
  page,
  context,
}) => {
  await context.clearPermissions();
  await page.goto("/");
  await page.evaluate(() =>
    Object.defineProperty(navigator, "geolocation", {
      configurable: true,
      value: {
        getCurrentPosition: (
          _ok: unknown,
          fail: (e: { code: number }) => void,
        ) => fail({ code: 1 }),
      },
    }),
  );
  await page.getByRole("button", { name: "Use my location" }).click();
  await expect(
    page.getByText(
      "Location permission denied. Choose a place on the map or list.",
    ),
  ).toBeVisible();
  await page
    .getByLabel("Municipality / city", { exact: true })
    .selectOption({ label: "Argao" });
  await expect(page.locator(".location-heading h2")).toHaveText("Argao");
});
test("GPS accepts Cebu, rejects out-of-region points, and reports timeout", async ({
  page,
  context,
}) => {
  await context.grantPermissions(["geolocation"]);
  await context.setGeolocation({
    latitude: 10.3157,
    longitude: 123.8854,
    accuracy: 20,
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Use my location" }).click();
  await expect(page.locator(".location-heading h2")).toHaveText("Cebu City");
  await expect(page.locator(".location-heading")).toContainText("±20 m");
  await page.evaluate(() => Object.defineProperty(navigator, "geolocation", {
    configurable: true,
    value: { getCurrentPosition: (ok: (position: unknown) => void) => ok({
      coords: { latitude: 0, longitude: 0, accuracy: 20 }
    }) }
  }));
  await page.getByRole("button", { name: "Use my location" }).click();
  await expect(
    page.getByText(
      "This location is outside Philippine land boundaries. Choose your farm on the map.",
    ),
  ).toBeVisible();
  await page.evaluate(() =>
    Object.defineProperty(navigator, "geolocation", {
      configurable: true,
      value: {
        getCurrentPosition: (
          _ok: unknown,
          fail: (e: { code: number }) => void,
        ) => fail({ code: 3 }),
      },
    }),
  );
  await page.getByRole("button", { name: "Use my location" }).click();
  await expect(
    page.getByText("GPS timed out. You can still select a location manually."),
  ).toBeVisible();
});

test("narrow overview stacks cards beside the map", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/");
  await expect(page.locator(".condition-card")).toHaveCount(4);
  for (const selector of [
    ".tanom-brand small",
    ".cebu-badge",
    ".page-intro p",
    ".card-footnote",
  ]) {
    await expect(page.locator(selector)).toHaveCount(0);
  }
  await expect(
    page.getByRole("heading", { name: "Find your Farm" }),
  ).toBeVisible();
  await expect(page.locator("#municipality-search")).toHaveCount(0);
  await expect(
    page.locator(".map-panel").getByRole("button", { name: "Use my location" }),
  ).toBeVisible();
  const column = await page.locator(".cards").boundingBox();
  const panel = await page.locator(".map-panel").boundingBox();
  expect(Math.abs(column!.y - panel!.y)).toBeLessThan(2);
  expect(panel!.width).toBe(420);
  await expect(page.locator(".map-panel .location-heading")).toBeVisible();
  expect(
    await page
      .locator(".map-panel .locationbar")
      .evaluate((el) =>
        Boolean(el.previousElementSibling?.classList.contains("cebu-map")),
      ),
  ).toBe(true);
  const main = await page.locator("main").boundingBox();
  expect(main!.width).toBeCloseTo(1440 * 0.65, 0);
  const cards = await page.locator(".cards").boundingBox();
  const map = await page.locator(".map-panel").boundingBox();
  expect(cards!.x + cards!.width).toBeLessThan(map!.x);
  await page.locator(".tanom-header .language").click();
  await expect(page.locator(".page-intro p")).toHaveCount(0);
  for (const width of [768, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    const left = await page.locator(".dashboard-panels").boundingBox();
    const right = await page.locator(".map-panel").boundingBox();
    expect(left!.y).toBeGreaterThanOrEqual(right!.y + right!.height);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});

test("bundled settlement dots select coordinates without a place API", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/");
  const dot = page.locator(".settlement-dot").first();
  await expect(dot).toBeVisible();
  await expect(dot).toHaveAttribute("role", "button");
  await dot.focus();
  await page.keyboard.press("Enter");
  await expect(page.locator(".location-heading p")).toContainText("° N");
  await expect(page.locator(".map-panel")).not.toContainText(
    "90 m elevation model",
  );
  await expect(page.getByLabel("Find a municipality")).toHaveCount(0);
  await page
    .getByLabel("Municipality / city", { exact: true })
    .selectOption({ label: "City of Bogo" });
  await expect(page.locator(".location-heading h2")).toHaveText("City of Bogo");
  await expect(page.locator(".settlement-dot").first()).toBeVisible();
});

test("four centered illustrated cards and simplified location panels", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator(".condition-card")).toHaveCount(4);
  await expect(page.locator(".condition-art")).toHaveCount(4);
  for (const width of [1440, 800, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    const boxes = await page.locator(".condition-card").evaluateAll((nodes) =>
      nodes.map((node) => {
        const r = node.getBoundingClientRect();
        return { x: r.x, y: r.y };
      }),
    );
    expect(boxes[0].y === boxes[1].y).toBe(width >= 600);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
  for (const path of ["/", "/conditions", "/environment", "/planning"]) {
    await page.goto(path);
    await expect(page.locator(".terrain-context")).toHaveCount(0);
    await expect(page.getByText(/Weather time:/)).toHaveCount(0);
    await expect(
      page.getByText(/Click the land or a settlement dot/),
    ).toHaveCount(0);
  }
});
