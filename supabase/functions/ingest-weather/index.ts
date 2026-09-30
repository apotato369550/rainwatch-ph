import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const url = Deno.env.get("SUPABASE_URL")!;
const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const db = createClient(url, key);
const variables = "precipitation,precipitation_probability,relative_humidity_2m,surface_pressure,cloud_cover,wind_speed_10m,cape,soil_moisture_0_to_1cm";
Deno.serve(async () => {
  const { data: locations, error } = await db.from("locations").select("id,latitude,longitude");
  if (error) return Response.json({ error: error.message }, { status: 500 });
  const generatedAt = new Date().toISOString();
  const results = await Promise.all((locations ?? []).map(async (location) => {
    try {
      const query = new URLSearchParams({ latitude: String(location.latitude), longitude: String(location.longitude), hourly: variables, timezone: "UTC", timeformat: "unixtime", past_days: "2", forecast_days: "3" });
      const response = await fetch(`https://api.open-meteo.com/v1/forecast?${query}`);
      if (!response.ok) throw new Error(`Open-Meteo ${response.status}`);
      const hourly = (await response.json()).hourly;
      const forecasts = hourly.time.map((time: number, i: number) => ({
        location_id: location.id, forecast_generated_at: generatedAt, forecast_for: new Date(time * 1000).toISOString(),
        precipitation: hourly.precipitation[i], precipitation_probability: hourly.precipitation_probability[i],
        humidity: hourly.relative_humidity_2m[i], surface_pressure: hourly.surface_pressure[i], cloud_cover: hourly.cloud_cover[i], wind_speed: hourly.wind_speed_10m[i], cape: hourly.cape[i], soil_moisture: hourly.soil_moisture_0_to_1cm[i],
      }));
      const { error: forecastError } = await db.from("weather_forecasts").upsert(forecasts, { onConflict: "location_id,forecast_generated_at,forecast_for", ignoreDuplicates: true });
      if (forecastError) throw forecastError;
      const current = hourly.time.length - 1 - [...hourly.time].reverse().findIndex((time: number) => time * 1000 <= Date.now());
      const observation = { ...forecasts[current], observed_at: forecasts[current].forecast_for, source: "open-meteo-forecast" };
      delete (observation as Record<string, unknown>).forecast_generated_at; delete (observation as Record<string, unknown>).forecast_for; delete (observation as Record<string, unknown>).precipitation_probability;
      const { error: observationError } = await db.from("weather_observations").upsert(observation, { onConflict: "location_id,observed_at" });
      if (observationError) throw observationError;
      // Replace provisional "current" values with a settled IFS historical-weather
      // proxy once the completed UTC day is available.
      const settled = new Date(Date.now() - 2 * 86400000).toISOString().slice(0, 10);
      const archiveQuery = new URLSearchParams({ latitude: String(location.latitude), longitude: String(location.longitude), start_date: settled, end_date: settled, models: "ecmwf_ifs", hourly: "precipitation,relative_humidity_2m,surface_pressure,cloud_cover,wind_speed_10m,cape,soil_moisture_0_to_1cm", timezone: "UTC" });
      const archiveResponse = await fetch(`https://archive-api.open-meteo.com/v1/archive?${archiveQuery}`);
      if (archiveResponse.ok) {
        const archive = (await archiveResponse.json()).hourly;
        const settledRows = archive.time.map((time: string, i: number) => ({ location_id: location.id, observed_at: new Date(`${time}Z`).toISOString(), precipitation: archive.precipitation[i], humidity: archive.relative_humidity_2m[i], surface_pressure: archive.surface_pressure[i], cloud_cover: archive.cloud_cover[i], wind_speed: archive.wind_speed_10m[i], cape: archive.cape[i], soil_moisture: archive.soil_moisture_0_to_1cm[i], source: "open-meteo-historical-weather-ifs" }));
        const { error: settledError } = await db.from("weather_observations").upsert(settledRows, { onConflict: "location_id,observed_at" });
        if (settledError) throw settledError;
      }
      return { ok: true };
    } catch (e) { return { ok: false, error: e instanceof Error ? e.message : "unknown" }; }
  }));
  return Response.json({ generatedAt, results });
});
