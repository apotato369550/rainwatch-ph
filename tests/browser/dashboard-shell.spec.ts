import { expect, test } from "@playwright/test";
import { environmentFixture, climateFixture } from "./tanom-fixtures";

test("navigation preserves one map, state, sizing and lazily enabled resources", async ({
  page,
}) => {
  let climateCalls = 0;
  let outlookCalls = 0;
  await page.route("**/api/environment?*", (r) =>
    r.fulfill({ json: environmentFixture() }),
  );
  await page.route("**/api/climate-profile?*", (r) => {
    climateCalls++;
    return r.fulfill({ json: climateFixture });
  });
  await page.route("**/api/outlook?*", (r) => {
    outlookCalls++;
    return r.fulfill({ json: climateFixture });
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/");
  const map = page.locator(".map-panel");
  await expect(page.locator(".leaflet-container")).toBeVisible();
  const node = await map.elementHandle();
  const before = await map.boundingBox();
  expect(climateCalls).toBe(0);
  expect(outlookCalls).toBe(0);
  for (const href of ["/conditions", "/environment", "/planning", "/ml", "/"]) {
    await page.locator(`.page-nav a[href="${href}"]`).click();
    await expect(page).toHaveURL(href === "/" ? /\/$/ : new RegExp(href + "$"));
    expect(
      await node!.evaluate((el) => el === document.querySelector(".map-panel")),
    ).toBe(true);
    await expect(page.locator(".dashboard-panel:not([hidden])")).toHaveCount(1);
    const after = await map.boundingBox();
    expect(after!.width).toBe(before!.width);
    expect(after!.height).toBe(before!.height);
  }
  expect(climateCalls).toBe(1);
  expect(outlookCalls).toBe(1);
  await page.goBack();
  await expect(page.locator('[data-section="ml"]')).toBeVisible();
  await page.goForward();
  await expect(page.locator('[data-section="home"]')).toBeVisible();
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(page.locator('[data-section="home"]')).toHaveCSS(
    "animation-name",
    "none",
  );
  await page.setViewportSize({ width: 390, height: 844 });
  const location = await map.boundingBox();
  const content = await page.locator(".dashboard-panels").boundingBox();
  expect(content!.y).toBeGreaterThan(location!.y + location!.height);
});
