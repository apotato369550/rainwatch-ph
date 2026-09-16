import "server-only";
import { unstable_cache } from "next/cache";
import { weatherSchema } from "./weather-schema";
import { summarizeWeather } from "./rainfall";
import type { Location } from "./types";
const fetchWeather = unstable_cache(
  async (latitude: number, longitude: number, hour: number) => {
    const url = new URL("https://api.open-meteo.com/v1/forecast");
    url.search = new URLSearchParams({
      latitude: String(latitude),
      longitude: String(longitude),
      hourly:
        "precipitation,rain,precipitation_probability,relative_humidity_2m,surface_pressure,cloud_cover,wind_speed_10m,cape,soil_moisture_0_to_1cm,temperature_2m",
      timezone: "Asia/Manila",
      timeformat: "unixtime",
      past_days: "2",
      forecast_days: "3",
      wind_speed_unit: "kmh",
      precipitation_unit: "mm",
    }).toString();
    const response = await fetch(url, {
      cache: "no-store",
      signal: AbortSignal.timeout(12000),
    });
    if (!response.ok)
      throw new Error(`Weather provider returned ${response.status}`);
    const data = weatherSchema.parse(await response.json());
    // Validate coverage before caching; the hour argument also rotates the cache at hour boundaries.
    if (!data.hourly.time.includes(hour * 3600))
      throw new Error("Outdated weather response");
    return { data, fetchedAt: new Date().toISOString() };
  },
  ["open-meteo-v1"],
  { revalidate: 600 },
);
export async function getWeather(location: Location) {
  const now = Date.now();
  const { data, fetchedAt } = await fetchWeather(
    location.latitude,
    location.longitude,
    Math.floor(now / 3_600_000),
  );
  return summarizeWeather(data, location, fetchedAt, now);
}
