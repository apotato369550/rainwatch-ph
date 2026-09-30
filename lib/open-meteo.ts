import "server-only";
import { unstable_cache } from "next/cache";
import { weatherSchema } from "./weather-schema";
import { summarizeWeather } from "./rainfall";
import { predictRainfall } from "./ml";
import { getSupabase } from "./supabase";
import type { Location } from "./types";
const fetchWeather = unstable_cache(async (latitude: number, longitude: number, hour: number) => {
  const url = new URL("https://api.open-meteo.com/v1/forecast");
  url.search = new URLSearchParams({ latitude: String(latitude), longitude: String(longitude), hourly: "precipitation,rain,precipitation_probability,relative_humidity_2m,surface_pressure,cloud_cover,wind_speed_10m,cape,soil_moisture_0_to_1cm,temperature_2m", timezone: "Asia/Manila", timeformat: "unixtime", past_days: "2", forecast_days: "3", wind_speed_unit: "kmh", precipitation_unit: "mm" }).toString();
  const response = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(12000) });
  if (!response.ok) throw new Error(`Weather provider returned ${response.status}`);
  const data = weatherSchema.parse(await response.json());
  if (!data.hourly.time.includes(hour * 3600)) throw new Error("Outdated weather response");
  return { data, fetchedAt: new Date().toISOString() };
}, ["open-meteo-v1"], { revalidate: 600 });

export async function getWeather(location: Location) {
  const now = Date.now(); const { data, fetchedAt } = await fetchWeather(location.latitude, location.longitude, Math.floor(now / 3_600_000));
  const summary = summarizeWeather(data, location, fetchedAt, now); const h = data.hourly;
  const current = h.time.indexOf(Math.floor(now / 3_600_000) * 3600);
  const prior = (hours: number) => h.precipitation.slice(Math.max(0, current - hours + 1), current + 1).reduce<number>((sum, value) => sum + (value ?? 0), 0);
  const predictions = await Promise.all(summary.hourly.map(async (hour, offset) => {
    const i = current + offset + 1; const time = new Date(hour.time * 1000);
    return predictRainfall(hour.rainfall, {
      raw_precipitation: hour.rainfall, precipitation_probability: h.precipitation_probability[i], humidity: h.relative_humidity_2m[i], surface_pressure: h.surface_pressure[i], cloud_cover: h.cloud_cover[i], wind_speed: h.wind_speed_10m[i], cape: h.cape[i], soil_moisture: h.soil_moisture_0_to_1cm[i], hour_sin: Math.sin((time.getUTCHours() + 8) * Math.PI / 12), hour_cos: Math.cos((time.getUTCHours() + 8) * Math.PI / 12), month_sin: Math.sin((time.getUTCMonth() + 1) * Math.PI / 6), month_cos: Math.cos((time.getUTCMonth() + 1) * Math.PI / 6), latitude: location.latitude, longitude: location.longitude, previous_3h_rainfall: prior(3), previous_6h_rainfall: prior(6), previous_24h_rainfall: prior(24), forecast_lead_hours: offset + 1,
    });
  }));
  summary.hourly = summary.hourly.map((hour, i) => ({ ...hour, correctedRainfall: predictions[i].correctedForecast }));
  const corrected = predictions.slice(0, 6); const first = predictions[0];
  summary.mlForecast = { rawNext6h: summary.next6hRainfall, correctedNext6h: corrected.every((p) => p.correctedForecast !== null) ? corrected.reduce((sum, p) => sum + (p.correctedForecast ?? 0), 0) : null, modelName: first?.modelName ?? null, modelVersion: first?.modelVersion ?? null, improvementKnown: first?.improvementKnown ?? false };
  void persistPredictions(location.id, summary.hourly, predictions);
  return summary;
}
async function persistPredictions(slug: string, hourly: { time: number; rainfall: number; correctedRainfall?: number | null }[], predictions: Awaited<ReturnType<typeof predictRainfall>>[]) {
  const db = getSupabase(); if (!db) return;
  const { data: location } = await db.from("locations").select("id").eq("slug", slug).maybeSingle(); if (!location) return;
  const rows = hourly.flatMap((hour, i) => predictions[i].correctedForecast === null || !predictions[i].modelVersion ? [] : [{ location_id: location.id, forecast_for: new Date(hour.time * 1000).toISOString(), raw_forecast: hour.rainfall, ml_forecast: predictions[i].correctedForecast, model_name: predictions[i].modelName, model_version: predictions[i].modelVersion }]);
  if (rows.length) await db.from("ml_predictions").upsert(rows, { onConflict: "location_id,forecast_for,model_version" });
}
