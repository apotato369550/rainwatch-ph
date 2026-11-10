import type { Environment, Climate } from "./contracts";
export type TrendRow = {
  time: string;
  temperature: number | null;
  rainfall: number | null;
  soil: number | null;
};
export function conditionRows(
  data: Environment | null,
  hourly: boolean,
): TrendRow[] {
  if (hourly)
    return (data?.hourlyConditions ?? [])
      .filter(
        (r) =>
          Date.parse(r.time) >=
          Math.floor(Date.parse(data?.observedAt ?? "") / 3600000) * 3600000,
      )
      .slice(0, 24)
      .map((r) => ({
        time: r.time,
        temperature: r.temperature,
        rainfall: r.rainfall,
        soil: r.soilMoisture,
      }));
  return (data?.days ?? []).map((day) => {
    const moisture = (data?.hourlyConditions ?? data?.hourlySoil ?? []).filter(
      (r) =>
        new Date(Date.parse(r.time) + 28800000).toISOString().slice(0, 10) ===
        day.date,
    );
    return {
      time: day.date + "T00:00:00+08:00",
      temperature: day.heat,
      rainfall: day.rain,
      soil:
        moisture.length === 24 && moisture.every((r) => r.soilMoisture !== null)
          ? moisture.reduce((sum, r) => sum + r.soilMoisture!, 0) / 24
          : null,
    };
  });
}
export function seasonalRows(data: Climate | null, period: "6" | "annual") {
  return (data?.months ?? []).slice(0, period === "annual" ? 12 : 6);
}
