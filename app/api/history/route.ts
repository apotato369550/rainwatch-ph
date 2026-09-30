import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
export async function GET(request: NextRequest) {
  const db = getSupabase(); if (!db) return NextResponse.json({ error: "Historical data is not configured." }, { status: 503 });
  const slug = request.nextUrl.searchParams.get("location") ?? "cebu";
  const days = Math.min(Math.max(Number(request.nextUrl.searchParams.get("days") ?? 7), 1), 31);
  const since = new Date(Date.now() - days * 86400000).toISOString();
  const { data: location } = await db.from("locations").select("id,name").eq("slug", slug).maybeSingle();
  if (!location) return NextResponse.json({ error: "Choose a supported Philippine city." }, { status: 400 });
  const [{ data: forecasts, error }, { data: observations }, { data: predictions }] = await Promise.all([
    db.from("weather_forecasts").select("forecast_for,precipitation,forecast_generated_at").eq("location_id", location.id).gte("forecast_for", since).order("forecast_generated_at", { ascending: false }).limit(5000),
    db.from("weather_observations").select("observed_at,precipitation").eq("location_id", location.id).gte("observed_at", since),
    db.from("ml_predictions").select("forecast_for,ml_forecast,created_at").eq("location_id", location.id).gte("forecast_for", since).order("created_at", { ascending: false }),
  ]);
  if (error) return NextResponse.json({ error: "Historical data is temporarily unavailable." }, { status: 502 });
  const raw = new Map<string, number>(); for (const row of forecasts ?? []) if (!raw.has(row.forecast_for)) raw.set(row.forecast_for, row.precipitation);
  const actual = new Map((observations ?? []).map((r) => [r.observed_at, r.precipitation])); const ml = new Map<string, number>(); for (const row of predictions ?? []) if (!ml.has(row.forecast_for)) ml.set(row.forecast_for, row.ml_forecast);
  const points = [...new Set([...raw.keys(), ...actual.keys(), ...ml.keys()])].sort().map((time) => ({ time, rawForecast: raw.get(time) ?? null, actual: actual.get(time) ?? null, mlForecast: ml.get(time) ?? null }));
  return NextResponse.json({ location: { slug, name: location.name }, points }, { headers: { "Cache-Control": "no-store" } });
}
