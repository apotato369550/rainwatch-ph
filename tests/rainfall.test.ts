import { test } from "node:test";
import assert from "node:assert/strict";
import {
  calculateStress,
  stressLevel,
  summarizeWeather,
} from "../lib/rainfall";
import { weatherSchema } from "../lib/weather-schema";
import { locations } from "../lib/locations";
const start = 1_800_000_000;
function fixture() {
  const values = (value: number) => Array<number | null>(72).fill(value);
  return {
    hourly: {
      time: Array.from({ length: 72 }, (_, i) => start + i * 3600),
      precipitation: values(1),
      rain: values(1),
      precipitation_probability: values(50),
      relative_humidity_2m: values(80),
      surface_pressure: values(1000),
      cloud_cover: values(80),
      wind_speed_10m: values(10),
      cape: values(500),
      soil_moisture_0_to_1cm: values(0.3),
      temperature_2m: values(28),
    },
  };
}
test("stress levels honor all boundaries", () => {
  assert.deepEqual([0, 29, 30, 49, 50, 69, 70, 84, 85, 100].map(stressLevel), [
    "Low",
    "Low",
    "Moderate",
    "Moderate",
    "Elevated",
    "Elevated",
    "High",
    "High",
    "Extreme",
    "Extreme",
  ]);
});
test("stress inputs clamp and missing features are disclosed", () => {
  assert.equal(calculateStress(500, 1000, 110, 0.9, 10000).stressScore, 100);
  assert.equal(calculateStress(0, 0, 20, 0, 0).stressScore, 0);
  const partial = calculateStress(50, 100, null, null, null);
  assert.equal(partial.stressScore, 65);
  assert.equal(partial.missingFeatures.length, 3);
});
test("preceding-hour sums separate past, current, and next 24 hours", () => {
  const raw = fixture();
  raw.hourly.precipitation[24] = 99;
  raw.hourly.precipitation[25] = 3;
  const result = summarizeWeather(
    weatherSchema.parse(raw),
    locations[0],
    "2027-01-15T00:00:00Z",
    (start + 24 * 3600 + 1800) * 1000,
  );
  assert.equal(result.current.rainfall, 99);
  assert.equal(result.next3hRainfall, 5);
  assert.equal(result.next6hRainfall, 8);
  assert.equal(result.next24hRainfall, 26);
  assert.equal(result.previous24hRainfall, 122);
  assert.equal(result.hourly.length, 24);
  assert.equal(result.peakRainfallPeriod?.start, start + 24 * 3600);
});
test("missing rainfall fails instead of inventing zero; missing probability remains unavailable", () => {
  const raw = fixture();
  raw.hourly.precipitation_probability[30] = null;
  const now = (start + 24 * 3600) * 1000;
  assert.equal(
    summarizeWeather(weatherSchema.parse(raw), locations[0], "", now)
      .precipitationProbability,
    null,
  );
  raw.hourly.precipitation[30] = null;
  assert.throws(
    () => summarizeWeather(weatherSchema.parse(raw), locations[0], "", now),
    /incomplete/,
  );
});
test("schema rejects misaligned, discontinuous, and invalid data", () => {
  const raw = fixture();
  raw.hourly.rain.pop();
  assert.equal(weatherSchema.safeParse(raw).success, false);
  const gap = fixture();
  gap.hourly.time[30] += 60;
  assert.equal(weatherSchema.safeParse(gap).success, false);
  const invalid = fixture();
  invalid.hourly.relative_humidity_2m[0] = 101;
  assert.equal(weatherSchema.safeParse(invalid).success, false);
});
test("dry forecast has no peak and insufficient coverage fails", () => {
  const raw = fixture();
  raw.hourly.precipitation.fill(0);
  const parsed = weatherSchema.parse(raw);
  assert.equal(
    summarizeWeather(parsed, locations[0], "", (start + 24 * 3600) * 1000)
      .peakRainfallPeriod,
    null,
  );
  assert.throws(
    () => summarizeWeather(parsed, locations[0], "", start * 1000),
    /window/,
  );
});
