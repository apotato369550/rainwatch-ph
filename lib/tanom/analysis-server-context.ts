import "server-only";
import { NextRequest } from "next/server";
import { GET as environment } from "@/app/api/environment/route";
import { GET as outlook } from "@/app/api/outlook/route";
import { GET as climate } from "@/app/api/climate-profile/route";
import { environmentSchema, climateSchema } from "./contracts";
import {
  dashboardContext,
  environmentContext,
  seasonalContext,
} from "./analysis-contract";
import { conditionRows } from "./view-data";
import type { Selection } from "./analysis-server";

// Call trusted server provider handlers directly, never a user/Host-derived URL.
// They validate Open-Meteo responses and retain the app's source definitions.
export async function serverContext(input: Selection) {
  const request = new NextRequest(
    `http://analysis.internal/?lat=${input.lat}&lon=${input.lon}`,
  );
  const load = async (handler: (request: NextRequest) => Promise<Response>) => {
    const response = await handler(request);
    if (!response.ok) throw new Error("Context provider unavailable");
    return response.json();
  };
  const view = input.context.view;
  if (view === "seasonal") {
    const period = input.context.period === "annual" ? "annual" : "6";
    const data = climateSchema.parse(
      await load(period === "annual" ? climate : outlook),
    );
    const result = seasonalContext(data, period);
    if (
      !result ||
      result.view !== "seasonal" ||
      result.climate.months.length !== (period === "annual" ? 12 : 6)
    )
      throw new Error("Incomplete climate");
    return result;
  }
  const data = environmentSchema.parse(await load(environment));
  if (view === "dashboard") return dashboardContext(data)!;
  if (view === "conditions") {
    const rows = conditionRows(data, true);
    if (
      rows.length !== 24 ||
      rows.some(
        (row, i) =>
          !Number.isFinite(Date.parse(row.time)) ||
          (i > 0 &&
            Date.parse(row.time) - Date.parse(rows[i - 1].time) !== 3600000),
      )
    )
      throw new Error("Incomplete hourly window");
    return {
      view: "conditions" as const,
      period: "hourly" as const,
      variable: "temperature" as const,
      rows,
      observedAt: data.observedAt,
      fetchedAt: data.fetchedAt,
    };
  }
  // Historical profile + static elevation. Never silently fall back to client data.
  const profile = climateSchema.parse(await load(climate));
  if (profile.months.length !== 12)
    throw new Error("Incomplete historical profile");
  return environmentContext(
    { ...data, observedAt: profile.fetchedAt, fetchedAt: profile.fetchedAt },
    profile,
  )!;
}
