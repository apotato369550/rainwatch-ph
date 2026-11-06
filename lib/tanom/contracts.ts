import { z } from "zod";
const value = z.number().finite().nullable();
export const daySchema = z.object({ date: z.string(), heat: value, rain: value });
export const environmentSchema = z.object({
  fetchedAt: z.string(), observedAt: z.string(), latitude: z.number(), longitude: z.number(),
  temperature: value, maximum: value, precipitation: value, dailyRain: value,
  probability: value, weatherCode: value, soilMoisture: value, soilTemperature: value,
  hourlyConditions:z.array(z.object({time:z.string(),temperature:value,rainfall:value,soilMoisture:value})).optional(),
  hourlySoil: z.array(z.object({time:z.string(),soilMoisture:value})).optional(),
  elevation: value, soilTime: z.string().nullable(), days: z.array(daySchema),
});
export const climateSchema = z.object({
  fetchedAt: z.string(), source: z.string(), months: z.array(daySchema.extend({ partial: z.boolean() })),
});
export type Environment = z.infer<typeof environmentSchema>;
export type Climate = z.infer<typeof climateSchema>;
export type ChartDay = z.infer<typeof daySchema>;
export type Point = { lat: number; lon: number };
