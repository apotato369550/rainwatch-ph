import { locations } from "../../lib/locations";
import { summarizeWeather } from "../../lib/rainfall";
import type { WeatherResponse } from "../../lib/weather-schema";
export type Scenario = "dry" | "heavy" | "missing";
export function forecastFixture(scenario: Scenario, id = "cebu") {
  const now = Date.parse("2026-09-10T10:00:00Z");
  const values = (value: number | null) => Array<number | null>(72).fill(value);
  const precipitation = Array.from({ length: 72 }, (_, i) =>
    scenario === "dry" ? 0 : i < 25 ? 2 : i < 31 ? 10 : 4,
  );
  const data: WeatherResponse = {
    hourly: {
      time: Array.from({ length: 72 }, (_, i) => now / 1000 + (i - 24) * 3600),
      precipitation,
      rain: precipitation,
      precipitation_probability: values(
        scenario === "missing" ? null : scenario === "dry" ? 5 : 92,
      ),
      relative_humidity_2m: values(scenario === "missing" ? null : 92),
      surface_pressure: values(1006),
      cloud_cover: values(90),
      wind_speed_10m: values(12),
      cape: values(scenario === "missing" ? null : 2000),
      soil_moisture_0_to_1cm: values(scenario === "missing" ? null : 0.4),
      temperature_2m: values(28),
    },
  };
  return summarizeWeather(
    data,
    locations.find((city) => city.id === id) ?? locations[0],
    new Date(now).toISOString(),
    now,
  );
}
