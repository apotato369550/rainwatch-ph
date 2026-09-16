import { NextRequest, NextResponse } from "next/server";
import { locations } from "@/lib/locations";
import { getWeather } from "@/lib/open-meteo";
export async function GET(request: NextRequest) {
  const id = request.nextUrl.searchParams.get("location") ?? "cebu";
  const location = locations.find((item) => item.id === id);
  if (!location)
    return NextResponse.json(
      { error: "Choose a supported Philippine city." },
      { status: 400 },
    );
  try {
    return NextResponse.json(await getWeather(location), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    console.error(
      "Weather fetch failed:",
      error instanceof Error ? error.message : "Unknown error",
    );
    return NextResponse.json(
      {
        error:
          "Live weather is temporarily unavailable. Please try again shortly.",
      },
      { status: 502, headers: { "Cache-Control": "no-store" } },
    );
  }
}
