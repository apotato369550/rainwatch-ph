import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { coordinates,badCoordinates,providerError,provider,common,dailySchema } from "@/lib/tanom/provider";
import { normals } from "@/lib/tanom/calculations";
export async function GET(request: NextRequest) {
  const p=coordinates(request);if(!p)return badCoordinates();
  try {
    const raw=z.object({daily:dailySchema}).parse(await provider("https://archive-api.open-meteo.com/v1/archive",{
      ...common(p),models:"era5",daily:"temperature_2m_mean,precipitation_sum",start_date:"1991-01-01",end_date:"2020-12-31",
    },86400));
    return NextResponse.json({fetchedAt:new Date().toISOString(),source:"ERA5 reanalysis · 1991–2020",months:normals(raw.daily.time.map((date,i)=>({date,heat:raw.daily.temperature_2m_mean[i],rain:raw.daily.precipitation_sum[i]})))});
  }catch{return providerError();}
}
