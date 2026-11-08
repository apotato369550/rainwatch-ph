import { test } from "node:test";
import assert from "node:assert/strict";
import { cropRecommendations } from "../lib/tanom/crops";
const profile = {
  source: "fixture",
  fetchedAt: "2026-01-01",
  months: Array.from({ length: 12 }, (_, i) => ({
    date: `2020-${String(i + 1).padStart(2, "0")}`,
    heat: 25,
    rain: 100,
    partial: false,
  })),
};
test("environment recommendations cap at three and use tolerances", () => {
  const results = cropRecommendations(profile, 100)!;
  assert.equal(results.length, 3);
  assert.ok(
    results.every((c) => c.unmet.length === 0 && c.absoluteTemp.length === 2),
  );
});
test("environment fills to two explicitly labelled alternatives", () => {
  const results = cropRecommendations(
    { ...profile, months: profile.months.map((m) => ({ ...m, heat: 60 })) },
    100,
  )!;
  assert.equal(results.length, 2);
  assert.ok(results.every((c) => c.unmet.includes("temperature")));
  assert.deepEqual(
    results,
    cropRecommendations(
      { ...profile, months: profile.months.map((m) => ({ ...m, heat: 60 })) },
      100,
    ),
  );
});
test("environment does not invent missing climate matches", () => {
  assert.equal(cropRecommendations(null, 100), null);
  assert.equal(cropRecommendations(profile, null), null);
});
