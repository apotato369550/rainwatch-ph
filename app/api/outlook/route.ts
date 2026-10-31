import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { coordinates,badCoordinates,providerError,provider,common,dailySchema } from "@/lib/tanom/provider";
import { monthly } from "@/lib/tanom/calculations";
export async function GET(request: NextRequest) {
  const p=coordinates(request); if(!p)return badCoordinates();
  try {
    const raw=z.object({daily:dailySchema}).parse(await provider("https://seasonal-api.open-meteo.com/v1/seasonal",{
      ...common(p),models:"ecmwf_seas5_ensemble_mean",daily:"temperature_2m_mean,precipitation_sum",forecast_days:"183",
    },86400));
    return NextResponse.json({fetchedAt:new Date().toISOString(),source:"ECMWF SEAS5 ensemble mean · regional, 36 km",months:monthly(raw.daily.time.map((date,i)=>({date,heat:raw.daily.temperature_2m_mean[i],rain:raw.daily.precipitation_sum[i]})))});
  }catch{return providerError();}
}
