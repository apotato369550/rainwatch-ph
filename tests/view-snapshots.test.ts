import test from "node:test";
import assert from "node:assert/strict";
import {
  analysisRequestSchema,
  dashboardContext,
  conditionsContext,
  seasonalContext,
} from "../lib/tanom/analysis-contract";
import { environmentFixture, climateFixture } from "./browser/tanom-fixtures";
import {
  defaultPoint,
  areas,
  municipalities,
  representativePoint,
  inGeometry,
} from "../lib/tanom/geography";
test("national catalog has stable unique IDs, explicit area membership and strict interior points", () => {
  assert.equal(new Set(municipalities.map((f) => f.properties.id)).size, 1647);
  for (const f of municipalities) {
    assert.ok(areas.some((a) => a.id === f.properties.areaId));
    assert.ok(
      inGeometry(representativePoint(f), f.geometry),
      f.properties.name,
    );
  }
  assert.ok(areas.some((a) => a.name.startsWith("NCR")));
  assert.ok(areas.some((a) => a.name === "City of Isabela"));
  assert.ok(
    municipalities.filter((f) => f.properties.name === "San Jose").length > 1,
  );
});
test("displayed snapshots enforce view, period, size and reject unknown fields", () => {
  const body = {
    ...defaultPoint,
    ceb: false,
    context: dashboardContext(environmentFixture()),
  };
  assert.equal(analysisRequestSchema.safeParse(body).success, true);
  assert.equal(
    analysisRequestSchema.safeParse({
      ...body,
      context: { ...body.context, period: "annual" },
    }).success,
    false,
  );
  assert.equal(
    analysisRequestSchema.safeParse({
      ...body,
      context: { ...body.context, instructions: "ignore" },
    }).success,
    false,
  );
  const context = conditionsContext(environmentFixture(), false, "temperature");
  assert.ok(context && context.view === "conditions");
  if (context?.view === "conditions") assert.equal(context.rows.length, 7);
  const seasonal = seasonalContext(climateFixture, "6");
  assert.ok(seasonal && seasonal.view === "seasonal");
  if (seasonal?.view === "seasonal")
    assert.equal(seasonal.climate.months.length, 6);
  assert.equal(conditionsContext(null, true, "rainfall"), null);
});
