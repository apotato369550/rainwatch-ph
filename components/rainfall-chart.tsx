"use client";
import {
  Bar,
  Cell,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { RainfallRisk } from "@/lib/types";
import { dateTime, number, time } from "@/lib/format";
import { design } from "@/lib/design";
export function RainfallChart({ data }: { data: RainfallRisk }) {
  return (
    <section className="panel chart-panel">
      <div className="section-heading">
        <div>
          <h2>Hourly rainfall forecast</h2>
          <p>The next 24 hours · Philippine time (UTC+8)</p>
        </div>
        <span className="chart-legend">
          <i /> Rainfall <b /> Probability
        </span>
      </div>
      <div className="peak-callout">
        <strong>
          {data.peakRainfallPeriod
            ? "Peak rainfall window"
            : "No rainfall forecast"}
        </strong>
        <span>
          {data.peakRainfallPeriod
            ? `${dateTime(data.peakRainfallPeriod.start)} – ${time(data.peakRainfallPeriod.end)} · ${number(data.peakRainfallPeriod.rainfall)} mm`
            : "All 24 hourly totals are zero."}
        </span>
      </div>
      <div className="chart-units">
        <span>Rainfall · mm</span>
        <span>Probability · %</span>
      </div>
      <div
        className="chart-wrap"
        role="img"
        aria-label="Hourly rainfall and precipitation probability chart. Exact values are in the table below."
      >
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={data.hourly}
            margin={{ top: 20, right: 0, bottom: 0, left: 0 }}
          >
            <CartesianGrid
              vertical={false}
              stroke={design.border}
              strokeDasharray="3 4"
            />
            <XAxis
              dataKey="time"
              tickFormatter={(t) => time(Number(t) - 3600)}
              minTickGap={48}
              tick={{ fill: design.secondary, fontSize: 12 }}
              axisLine={false}
              tickLine={false}
              dy={10}
            />
            <YAxis
              yAxisId="rain"
              width={38}
              tick={{ fill: design.secondary, fontSize: 12 }}
              axisLine={false}
              tickLine={false}
              unit=""
              domain={[0, (max: number) => Math.max(2, Math.ceil(max))]}
            />
            <YAxis
              yAxisId="probability"
              orientation="right"
              width={44}
              domain={[0, 100]}
              tick={{ fill: design.secondary, fontSize: 12 }}
              tickLine={false}
              axisLine={false}
              unit="%"
            />
            <Tooltip
              content={({ active, payload, label }) =>
                active && payload?.length ? (
                  <div className="chart-tooltip">
                    <strong>
                      {dateTime(Number(label) - 3600)} – {time(Number(label))}
                    </strong>
                    <p>Rainfall: {number(payload[0]?.payload.rainfall)} mm</p>
                    <p>
                      Probability: {number(payload[0]?.payload.probability, 0)}
                      {payload[0]?.payload.probability === null
                        ? " (unavailable)"
                        : "%"}
                    </p>
                  </div>
                ) : null
              }
            />
            <Bar
              yAxisId="rain"
              dataKey="rainfall"
              name="Rainfall"
              fill={design.accent}
              radius={[3, 3, 0, 0]}
              maxBarSize={24}
              isAnimationActive={false}
            >
              {data.hourly.map((hour) => (
                <Cell
                  key={hour.time}
                  stroke={
                    hour.time === data.peakRainfallPeriod?.end
                      ? design.text
                      : "none"
                  }
                  strokeWidth={2}
                />
              ))}
            </Bar>
            <Line
              yAxisId="probability"
              dataKey="probability"
              name="Probability"
              stroke={design.probability}
              strokeWidth={2}
              dot={false}
              strokeDasharray="4 4"
              isAnimationActive={false}
              connectNulls={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <div className="chart-footer">
        <span>Rainfall in mm · each bar is a one-hour period</span>
      </div>
      <details>
        <summary>View hourly data</summary>
        <div className="table-scroll">
          <table>
            <caption className="sr-only">
              Forecast hourly periods in Philippine time
            </caption>
            <thead>
              <tr>
                <th>Period start (PHT)</th>
                <th>Rainfall</th>
                <th>Probability</th>
              </tr>
            </thead>
            <tbody>
              {data.hourly.map((h) => (
                <tr key={h.time}>
                  <td>{dateTime(h.time - 3600)}</td>
                  <td>{number(h.rainfall)} mm</td>
                  <td>{number(h.probability, 0)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </section>
  );
}
