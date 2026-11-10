"use client";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { ChartDay } from "@/lib/tanom/contracts";
export function SeasonalGraphs({
  rows,
  ceb,
}: {
  rows: (ChartDay & { partial?: boolean })[];
  ceb: boolean;
}) {
  return (
    <div className="seasonal-graphs">
      {(["heat", "rain"] as const).map((metric) => {
        const label =
          metric === "heat"
            ? ceb
              ? "Temperatura"
              : "Temperature"
            : ceb
              ? "Ulan"
              : "Rainfall";
        const unit = metric === "heat" ? "°C" : "mm";
        const dateLabel = (date: string) =>
          new Date(date + "-01T00:00:00+08:00").toLocaleDateString(
            ceb ? "ceb-PH" : "en-PH",
            { month: "short", timeZone: "Asia/Manila" },
          );
        return (
          <section
            key={metric}
            className={
              "tanom-panel condition-graph " +
              (metric === "heat" ? "heat" : "water")
            }
          >
            <h3>
              {label} · {unit}
            </h3>
            <div
              className="tanom-chart"
              role="img"
              aria-label={label + " · " + unit}
            >
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={rows}
                  accessibilityLayer
                  margin={{ top: 15, right: 15, left: 0, bottom: 10 }}
                >
                  <CartesianGrid
                    vertical={false}
                    stroke="#72818a"
                    strokeDasharray="3 5"
                  />
                  <XAxis
                    dataKey="date"
                    tickFormatter={dateLabel}
                    minTickGap={20}
                  />
                  <YAxis width={64} tickCount={5} tick={{ fontSize: 12 }} />
                  <Tooltip
                    labelFormatter={(v) =>
                      dateLabel(String(v)) +
                      (rows.find((row) => row.date === String(v))?.partial
                        ? ceb
                          ? " · Dili kompleto nga bulan"
                          : " · Partial month"
                        : "")
                    }
                  />
                  <Line
                    dataKey={metric}
                    name={label + " · " + unit}
                    stroke={metric === "heat" ? "#923e12" : "#176080"}
                    strokeWidth={3}
                    dot={false}
                    connectNulls={false}
                    isAnimationActive={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
            {rows.some((row) => row.partial) && (
              <p className="microcopy">
                {ceb
                  ? "Adunay dili kompleto nga bulan; dili gipuno ang kulang nga datos."
                  : "Includes partial months; missing days are not extrapolated."}
              </p>
            )}
          </section>
        );
      })}
    </div>
  );
}
