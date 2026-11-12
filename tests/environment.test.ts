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
test("environment recommendations cap at seven and use tolerances", () => {
  const results = cropRecommendations(profile, 100)!;
  assert.equal(results.length, 7);
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

test("expanded catalog retains sourced thresholds and deterministic ranking", () => {
  const results = cropRecommendations(profile, 100)!;
  assert.deepEqual(results, cropRecommendations(profile, 100));
  assert.ok(results.some((c) => c.id === 1265));
  assert.ok(results.some((c) => c.id === 1420));
  assert.ok(results.some((c) => c.id === 820));
  for (let i = 1; i < results.length; i++) {
    assert.ok(results[i - 1].score >= results[i].score);
  }
});
