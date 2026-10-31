import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { coordinates, badCoordinates, providerError, provider, common, nullable } from "@/lib/tanom/provider";
const schema = z.object({
  elevation: nullable,
  current: z.object({time:z.number(),temperature_2m:nullable,precipitation:nullable,weather_code:nullable}),
  hourly: z.object({time:z.array(z.number()),soil_moisture_0_to_1cm:z.array(nullable),soil_temperature_0cm:z.array(nullable)}).refine(h=>h.time.length===h.soil_moisture_0_to_1cm.length&&h.time.length===h.soil_temperature_0cm.length),
  daily: z.object({time:z.array(z.number()),temperature_2m_max:z.array(nullable),precipitation_sum:z.array(nullable),precipitation_probability_max:z.array(nullable)}).refine(d=>Object.values(d).every(a=>a.length===d.time.length)&&d.time.length===7),
});
export async function GET(request: NextRequest) {
  const p = coordinates(request); if (!p) return badCoordinates();
  try {
    const raw = schema.parse(await provider("https://api.open-meteo.com/v1/forecast",{
      ...common(p),timeformat:"unixtime",current:"temperature_2m,precipitation,weather_code",
      hourly:"soil_moisture_0_to_1cm,soil_temperature_0cm",
      daily:"temperature_2m_max,precipitation_sum,precipitation_probability_max",forecast_days:"7",
    },600));
    const index = raw.hourly.time.findIndex(t=>t===Math.floor(raw.current.time/3600)*3600);
    const date = (t:number) => new Date((t+28800)*1000).toISOString().slice(0,10);
    return NextResponse.json({
      latitude:p.lat,longitude:p.lon,fetchedAt:new Date().toISOString(),observedAt:new Date(raw.current.time*1000).toISOString(),
      temperature:raw.current.temperature_2m,weatherCode:raw.current.weather_code,precipitation:raw.current.precipitation,
      maximum:raw.daily.temperature_2m_max[0],dailyRain:raw.daily.precipitation_sum[0],probability:raw.daily.precipitation_probability_max[0],
      soilMoisture:index<0?null:raw.hourly.soil_moisture_0_to_1cm[index],
      soilTemperature:index<0?null:raw.hourly.soil_temperature_0cm[index],
      soilTime:index<0?null:new Date(raw.hourly.time[index]*1000).toISOString(),elevation:raw.elevation,
      days:raw.daily.time.map((t,i)=>({date:date(t),heat:raw.daily.temperature_2m_max[i],rain:raw.daily.precipitation_sum[i]})),
    });
  } catch { return providerError(); }
}
