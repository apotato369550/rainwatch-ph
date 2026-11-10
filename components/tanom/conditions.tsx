"use client";
import { useId, useRef, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { conditionRows } from "@/lib/tanom/view-data";
import { Analysis } from "./analysis";
import {
  analysisRequest,
  conditionsContext,
} from "@/lib/tanom/analysis-contract";
import type { Point } from "@/lib/tanom/contracts";
import type { Environment } from "@/lib/tanom/contracts";
export function Conditions({
  data,
  ceb,
  point,
}: {
  data: Environment | null;
  ceb: boolean;
  point: Point;
}) {
  const [hourly, setHourly] = useState(false);
  const [selected, setSelected] = useState(0);
  const id = useId();
  const stackRef = useRef<HTMLDivElement>(null);
  const t = (en: string, ce: string) => (ceb ? ce : en);
  const rows = conditionRows(data, hourly);
  const dateLabel = (value: string, full = false) =>
    new Date(value).toLocaleString(ceb ? "ceb-PH" : "en-PH", {
      timeZone: "Asia/Manila",
      ...(full
        ? { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }
        : hourly
          ? { hour: "numeric" }
          : { weekday: "short" }),
    });
  const series = [
    {
      key: "temperature",
      title: t(
        hourly ? "Temperature" : "Daily maximum temperature",
        "Temperatura",
      ),
      unit: "°C",
      color: "#923e12",
      theme: "heat",
    },
    {
      key: "rainfall",
      title: t("Rainfall", "Ulan"),
      unit: "mm",
      color: "#176080",
      theme: "water",
    },
    {
      key: "soil",
      title: t(
        hourly ? "Hourly surface moisture" : "Daily mean surface moisture",
        "Kaumog sa nawong sa yuta",
      ),
      unit: "m³/m³",
      color: "#765811",
      theme: "soil",
    },
  ] as const;
  const s = series[selected];
  const values = rows.flatMap((row) =>
    row[s.key] === null ? [] : [row[s.key]!],
  );
  const labels = [
    t("Temperature", "Temperatura"),
    t("Rainfall", "Ulan"),
    t("Surface moisture", "Kaumog sa nawong"),
  ];
  const request = analysisRequest(
    point,
    ceb,
    conditionsContext(
      data,
      hourly,
      s.key as "temperature" | "rainfall" | "soil",
    ),
  );
  return (
    <div ref={stackRef} className="conditions-stack">
      <section className="tanom-panel">
        <div className="conditions-title-row">
          <h2>{t("Your conditions", "Kondisyon sa imong lugar")}</h2>
          <button
            className="language period-switch"
            role="switch"
            aria-label={t("Hourly graphs", "Matag oras nga grap")}
            aria-checked={hourly}
            onClick={() => setHourly((value) => !value)}
          >
            <span>{t("Weekly", "Matag semana")}</span>
            <span className="switch-track">
              <span className="switch-thumb" />
            </span>
            <span>{t("Hourly", "Matag oras")}</span>
          </button>
        </div>
      </section>
      <section className={"tanom-panel condition-graph " + s.theme}>
        <div
          className="condition-tabs"
          role="tablist"
          aria-label={t("Graph variable", "Variable sa grap")}
        >
          {series.map((item, index) => (
            <button
              key={item.key}
              id={id + "-tab-" + index}
              role="tab"
              aria-selected={selected === index}
              aria-controls={id + "-panel"}
              tabIndex={selected === index ? 0 : -1}
              onClick={() => setSelected(index)}
              onKeyDown={(event) => {
                let next = index;
                if (event.key === "ArrowRight") next = (index + 1) % 3;
                else if (event.key === "ArrowLeft") next = (index + 2) % 3;
                else if (event.key === "Home") next = 0;
                else if (event.key === "End") next = 2;
                else return;
                event.preventDefault();
                setSelected(next);
                document.getElementById(id + "-tab-" + next)?.focus();
              }}
            >
              {labels[index]}
            </button>
          ))}
        </div>
        <div
          className="condition-plot-panel"
          id={id + "-panel"}
          role="tabpanel"
          aria-labelledby={id + "-tab-" + selected}
          tabIndex={0}
        >
          <h2>
            {s.title} · {s.unit}
          </h2>
          {values.length ? (
            <>
              <div className="tanom-chart" aria-label={s.title} role="img">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    key={s.key + "-" + (hourly ? "hourly" : "weekly")}
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
                      dataKey="time"
                      tickFormatter={(v) => dateLabel(v)}
                      minTickGap={20}
                    />
                    <YAxis
                      yAxisId="selected"
                      width={64}
                      tickCount={5}
                      minTickGap={16}
                      tick={{ fontSize: 12 }}
                      tickFormatter={(value: number) =>
                        Number(
                          value.toFixed(s.key === "soil" ? 3 : 1),
                        ).toString()
                      }
                    />
                    <Tooltip
                      labelFormatter={(v) => dateLabel(String(v), true)}
                    />
                    <Line
                      yAxisId="selected"
                      dataKey={s.key}
                      name={s.title + " · " + s.unit}
                      stroke={s.color}
                      strokeWidth={3}
                      connectNulls={false}
                      dot={false}
                      isAnimationActive={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <p className="microcopy">
                {t("Forecast range", "Han-ay sa forecast")}:{" "}
                {Math.min(...values).toFixed(s.key === "soil" ? 3 : 1)}–
                {Math.max(...values).toFixed(s.key === "soil" ? 3 : 1)} {s.unit}
                {s.key === "soil" ? " · 0–1 cm" : ""}
              </p>
            </>
          ) : (
            <p role="status">
              {t(
                "Forecast unavailable for this period.",
                "Walay forecast alang niini nga panahon.",
              )}
            </p>
          )}
        </div>
      </section>
      <Analysis key={JSON.stringify(request)} request={request} ceb={ceb} />
    </div>
  );
}
