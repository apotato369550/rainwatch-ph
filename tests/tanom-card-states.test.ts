import { test } from "node:test";
import assert from "node:assert/strict";
import { rainBand, soilBand, elevationBand } from "../lib/tanom/card-states";
import { weatherKind } from "../lib/tanom/calculations";
test("card bands honor boundaries and unavailable values", () => {
  for (const band of [rainBand, soilBand, elevationBand]) {
    for (const value of [null, undefined, NaN, Infinity])
      assert.equal(band(value), -1);
  }
  for (const [value, expected] of [
    [0, 0],
    [0.01, 1],
    [1.999, 1],
    [2, 2],
    [9.999, 2],
    [10, 3],
    [29.999, 3],
    [30, 4],
  ])
    assert.equal(rainBand(value), expected);
  for (const [value, expected] of [
    [0, 0],
    [0.099, 0],
    [0.1, 1],
    [0.299, 1],
    [0.3, 2],
    [0.449, 2],
    [0.45, 3],
  ])
    assert.equal(soilBand(value), expected);
  for (const [value, expected] of [
    [-10, 0],
    [199, 0],
    [200, 1],
    [499, 1],
    [500, 2],
    [999, 2],
    [1000, 3],
  ])
    assert.equal(elevationBand(value), expected);
});
test("heat illustrations retain weather-code states", () => {
  for (const [code, state] of [
    [0, "sun"],
    [2, "partly"],
    [3, "cloud"],
    [61, "rain"],
    [95, "storm"],
    [71, "snow"],
    [null, "unknown"],
  ] as const)
    assert.equal(weatherKind(code), state);
});
