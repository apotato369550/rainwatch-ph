import type {
  ContributingFactor,
  Location,
  RainfallRisk,
  StressLevel,
} from "./types";
import type { WeatherResponse } from "./weather-schema";
export const clamp = (value: number) => Math.min(1, Math.max(0, value));
export function stressLevel(score: number): StressLevel {
  return score < 30
    ? "Low"
    : score < 50
      ? "Moderate"
      : score < 70
        ? "Elevated"
        : score < 85
          ? "High"
          : "Extreme";
}
export function calculateStress(
  rain6h: number,
  rain24h: number,
  humidity: number | null,
  soil: number | null,
  cape: number | null,
) {
  const factor = (
    name: string,
    value: number | null,
    unit: string,
    normalized: number,
    maxPoints: number,
    description: string,
  ): ContributingFactor => ({
    name,
    value,
    unit,
    points: value === null ? 0 : clamp(normalized) * maxPoints,
    maxPoints,
    description,
  });
  const factors = [
    factor(
      "6-hour rainfall",
      rain6h,
      "mm",
      rain6h / 50,
      35,
      "Rain concentrated into a short window is the strongest contributor.",
    ),
    factor(
      "24-hour rainfall",
      rain24h,
      "mm",
      rain24h / 100,
      30,
      "Accumulated rainfall adds to the overall rainfall load.",
    ),
    factor(
      "Humidity",
      humidity,
      "%",
      ((humidity ?? 60) - 60) / 40,
      10,
      "Moist air can support continued rainfall.",
    ),
    factor(
      "Surface soil moisture",
      soil,
      "m³/m³",
      ((soil ?? 0.1) - 0.1) / 0.4,
      15,
      "Wetter surface soil increases this experimental indicator; it does not measure drainage.",
    ),
    factor(
      "CAPE",
      cape,
      "J/kg",
      (cape ?? 0) / 2500,
      10,
      "Atmospheric instability can support convection, but does not guarantee thunderstorms.",
    ),
  ];
  const score = Math.round(factors.reduce((sum, f) => sum + f.points, 0));
  return {
    stressScore: score,
    stressLevel: stressLevel(score),
    contributingFactors: factors.sort((a, b) => b.points - a.points),
    missingFeatures: factors.filter((f) => f.value === null).map((f) => f.name),
  };
}
export function summarizeWeather(
  data: WeatherResponse,
  location: Location,
  fetchedAt: string,
  now = Date.now(),
): RainfallRisk {
  const h = data.hourly;
  const currentHour = Math.floor(now / 3_600_000) * 3600;
  const index = h.time.indexOf(currentHour);
  if (index < 24 || index + 24 >= h.time.length)
    throw new Error(
      "Weather response does not cover the required time window.",
    );
  const currentRainfall = h.precipitation[index];
  if (currentRainfall === null)
    throw new Error("Current hourly rainfall is unavailable.");
  // Precipitation is a preceding-hour sum: t+1 describes the interval [t, t+1].
  const hourly = h.time.slice(index + 1, index + 25).map((end, offset) => {
    const i = index + 1 + offset;
    if (h.precipitation[i] === null)
      throw new Error("The rainfall forecast is incomplete.");
    return {
      time: end,
      rainfall: h.precipitation[i] as number,
      probability: h.precipitation_probability[i],
    };
  });
  const sum = (hours: number) =>
    hourly.slice(0, hours).reduce((total, item) => total + item.rainfall, 0);
  const past = h.precipitation.slice(index - 23, index + 1);
  const previous24hRainfall = past.some((v) => v === null)
    ? null
    : past.reduce<number>((total, value) => total + (value ?? 0), 0);
  const probability = hourly.map((h) => h.probability);
  const peak = hourly.reduce((best, hour) =>
    hour.rainfall > best.rainfall ? hour : best,
  );
  const atmosphericFeatures = {
    humidity: h.relative_humidity_2m[index],
    surfacePressure: h.surface_pressure[index],
    cloudCover: h.cloud_cover[index],
    windSpeed: h.wind_speed_10m[index],
    cape: h.cape[index],
    soilMoisture: h.soil_moisture_0_to_1cm[index],
  };
  return {
    location,
    fetchedAt,
    current: {
      time: currentHour,
      rainfall: currentRainfall,
      rain: h.rain[index],
      temperature: h.temperature_2m[index],
    },
    next3hRainfall: sum(3),
    next6hRainfall: sum(6),
    next24hRainfall: sum(24),
    previous24hRainfall,
    precipitationProbability: probability.some((v) => v === null)
      ? null
      : Math.max(...(probability as number[])),
    peakRainfallPeriod:
      peak.rainfall > 0
        ? { start: peak.time - 3600, end: peak.time, rainfall: peak.rainfall }
        : null,
    atmosphericFeatures,
    hourly,
    mlForecast: { rawNext6h: sum(6), correctedNext6h: null, modelName: null, modelVersion: null, improvementKnown: false },
    ...calculateStress(
      sum(6),
      sum(24),
      atmosphericFeatures.humidity,
      atmosphericFeatures.soilMoisture,
      atmosphericFeatures.cape,
    ),
  };
}
