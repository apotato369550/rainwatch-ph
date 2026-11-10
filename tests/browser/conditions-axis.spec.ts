import { expect, test } from "@playwright/test";
import { environmentFixture } from "./tanom-fixtures";

test("selected graph retains exactly one scale after repeated variable changes", async ({
  page,
}) => {
  const hourlyConditions = Array.from({ length: 168 }, (_, i) => ({
    time: new Date(Date.UTC(2026, 9, 31, 16 + i)).toISOString(),
    temperature: 24 + (i % 7),
    rainfall: i % 4,
    soilMoisture: 0.25 + (i % 5) * 0.01,
  }));
  await page.route("**/api/environment?*", (route) =>
    route.fulfill({
      json: {
        ...environmentFixture(),
        observedAt: "2026-11-01T00:00:00Z",
        hourlyConditions,
      },
    }),
  );
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto("/conditions");
    for (const hourly of [false, true]) {
      if (hourly)
        await page.getByRole("switch", { name: "Hourly graphs" }).click();
      for (let repeat = 0; repeat < 2; repeat++)
        for (const [name, max] of [
          ["Temperature", 50],
          ["Rainfall", 20],
          ["Surface moisture", 1],
          ["Temperature", 50],
        ] as const) {
          await page.getByRole("tab", { name, exact: true }).click();
          const graph = page.locator(".condition-graph");
          await expect(graph.locator(".recharts-yAxis")).toHaveCount(1);
          await expect(graph.locator(".recharts-line")).toHaveCount(1);
          await expect
            .poll(async () => {
              const ticks = await graph
                .locator(".recharts-yAxis-tick-labels .recharts-cartesian-axis-tick-value")
                .allTextContents();
              return (
                ticks.length > 0 && ticks.every((tick) => Number(tick) <= max)
              );
            })
            .toBe(true);
          const boxes = await graph
            .locator(".recharts-yAxis-tick-labels .recharts-cartesian-axis-tick-value")
            .evaluateAll((nodes) =>
              nodes
                .map((node) => {
                  const b = node.getBoundingClientRect();
                  return { top: b.top, bottom: b.bottom };
                })
                .sort((a, b) => a.top - b.top),
            );
          for (let i = 1; i < boxes.length; i++)
            expect(boxes[i].top).toBeGreaterThanOrEqual(boxes[i - 1].bottom);
        }
    }
    await page.screenshot({
      path: test.info().outputPath("axis-" + width + ".png"),
      fullPage: true,
    });
  }
});
