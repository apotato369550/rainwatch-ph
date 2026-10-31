import "server-only";
import { z } from "zod";
import { NextRequest, NextResponse } from "next/server";
import { findMunicipality } from "./geography";
export function coordinates(request: NextRequest) {
  const a = request.nextUrl.searchParams.get("lat");
  const b = request.nextUrl.searchParams.get("lon");
  if (!a?.trim() || !b?.trim()) return null;
  const lat = Number(a), lon = Number(b);
  return Number.isFinite(lat) && Number.isFinite(lon) && findMunicipality({lat,lon}) ? {lat,lon} : null;
}
export const badCoordinates = () => NextResponse.json({error:"Select a land location within Cebu."},{status:400});
export const providerError = () => NextResponse.json({error:"Environmental data is temporarily unavailable. Please retry."},{status:502});
export const nullable = z.number().finite().nullable();
const dates = z.array(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).min(1);
export const dailySchema = z.object({time: dates, temperature_2m_mean: z.array(nullable), precipitation_sum: z.array(nullable)})
  .refine(d => d.time.length === d.temperature_2m_mean.length && d.time.length === d.precipitation_sum.length)
  .refine(d => d.time.every((s,i) => i === 0 || Date.parse(s)-Date.parse(d.time[i-1]) === 86400000));
export async function provider(url: string, params: Record<string,string>, cache: number) {
  const target = new URL(url); target.search = new URLSearchParams(params).toString();
  const response = await fetch(target, {signal:AbortSignal.timeout(25000), next:{revalidate:cache}});
  if (!response.ok) throw new Error("Provider request failed");
  return response.json();
}
export const common = (p: {lat:number;lon:number}) => ({latitude:String(p.lat),longitude:String(p.lon),timezone:"Asia/Manila"});
