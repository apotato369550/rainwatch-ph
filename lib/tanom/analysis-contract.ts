import { z } from "zod";
import type { Environment, Climate, Point } from "./contracts";
import { conditionRows, seasonalRows } from "./view-data";
const n = z.number().finite().nullable();
const timestamp = z
  .string()
  .max(40)
  .refine((v) => Number.isFinite(Date.parse(v)));
const current = z
  .object({
    temperature: n,
    maximum: n,
    precipitation: n,
    dailyRain: n,
    probability: z.number().min(0).max(100).nullable(),
    weatherCode: n,
    soilMoisture: n,
    soilTemperature: n,
    elevation: n,
    soilTime: timestamp.nullable(),
  })
  .strict();
const row = z
  .object({ time: timestamp, temperature: n, rainfall: n, soil: n })
  .strict();
const month = z
  .object({
    date: z.string().regex(/^\d{4}-\d{2}$/),
    heat: n,
    rain: n,
    partial: z.boolean(),
  })
  .strict();
const climate = z
  .object({
    fetchedAt: timestamp,
    source: z.string().min(1).max(240),
    months: z.array(month).min(1).max(12),
  })
  .strict();
export const analysisRequestSchema = z
  .object({
    lat: z.number().finite(),
    lon: z.number().finite(),
    ceb: z.boolean(),
    context: z.discriminatedUnion("view", [
      z
        .object({
          view: z.literal("dashboard"),
          period: z.literal("current"),
          observedAt: timestamp,
          fetchedAt: timestamp,
          current,
        })
        .strict(),
      z
        .object({
          view: z.literal("conditions"),
          period: z.enum(["daily", "hourly"]),
          observedAt: timestamp,
          fetchedAt: timestamp,
          variable: z.enum(["temperature", "rainfall", "soil"]),
          rows: z.array(row).min(1).max(24),
        })
        .strict(),
      z
        .object({
          view: z.literal("seasonal"),
          period: z.enum(["6", "annual"]),
          climate,
        })
        .strict(),
      z
        .object({
          view: z.literal("environment"),
          period: z.literal("climate"),
          observedAt: timestamp,
          fetchedAt: timestamp,
          elevation: n,
          climate: climate.nullable(),
        })
        .strict(),
    ]),
  })
  .strict()
  .superRefine((value, ctx) => {
    const c = value.context;
    if (
      c.view === "conditions" &&
      c.rows.length > (c.period === "hourly" ? 24 : 7)
    )
      ctx.addIssue({ code: "custom", message: "Too many rows" });
    if (
      c.view === "seasonal" &&
      c.climate.months.length > (c.period === "6" ? 6 : 12)
    )
      ctx.addIssue({ code: "custom", message: "Too many months" });
  });
export type AnalysisRequest = z.infer<typeof analysisRequestSchema>;
export type AnalysisContext = AnalysisRequest["context"];
export function dashboardContext(
  data: Environment | null,
): AnalysisContext | null {
  if (!data) return null;
  const {
    temperature,
    maximum,
    precipitation,
    dailyRain,
    probability,
    weatherCode,
    soilMoisture,
    soilTemperature,
    elevation,
    soilTime,
  } = data;
  return {
    view: "dashboard",
    period: "current",
    observedAt: data.observedAt,
    fetchedAt: data.fetchedAt,
    current: {
      temperature,
      maximum,
      precipitation,
      dailyRain,
      probability,
      weatherCode,
      soilMoisture,
      soilTemperature,
      elevation,
      soilTime,
    },
  };
}
export function conditionsContext(
  data: Environment | null,
  hourly: boolean,
  variable: "temperature" | "rainfall" | "soil",
): AnalysisContext | null {
  const rows = conditionRows(data, hourly);
  return data && rows.some((row) => row[variable] !== null)
    ? {
        view: "conditions",
        period: hourly ? "hourly" : "daily",
        variable,
        rows,
        observedAt: data.observedAt,
        fetchedAt: data.fetchedAt,
      }
    : null;
}
export function seasonalContext(
  data: Climate | null,
  period: "6" | "annual",
): AnalysisContext | null {
  return data && data.months.length
    ? {
        view: "seasonal",
        period,
        climate: { ...data, months: seasonalRows(data, period) },
      }
    : null;
}
export function environmentContext(
  data: Environment | null,
  climate: Climate | null,
): AnalysisContext | null {
  return data
    ? {
        view: "environment",
        period: "climate",
        observedAt: data.observedAt,
        fetchedAt: data.fetchedAt,
        elevation: data.elevation,
        climate,
      }
    : null;
}
export function analysisRequest(
  point: Point,
  ceb: boolean,
  context: AnalysisContext | null,
) {
  return context ? { ...point, ceb, context } : null;
}
