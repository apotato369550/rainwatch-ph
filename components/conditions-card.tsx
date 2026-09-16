import { CloudRain, Droplets, Wind, Gauge, Cloud } from "lucide-react";
import type { RainfallRisk } from "@/lib/types";
import { number, time } from "@/lib/format";
export function ConditionsCard({ data }: { data: RainfallRisk }) {
  const a = data.atmosphericFeatures;
  return (
    <section className="panel conditions">
      <div className="section-heading">
        <h2>Current conditions</h2>
        <span className="eyebrow">Hourly model</span>
      </div>
      <div className="current-main">
        <div>
          <div className="big-value">
            {number(data.current.rainfall)}
            <span>mm</span>
          </div>
          <p>Rainfall in the hour ending {time(data.current.time)}</p>
        </div>
        <CloudRain size={66} strokeWidth={1.2} className="rain-icon" />
      </div>
      <div className="condition-grid">
        {[
          {
            icon: Droplets,
            label: "Humidity",
            value: `${number(a.humidity, 0)}%`,
          },
          { icon: Wind, label: "Wind", value: `${number(a.windSpeed)} km/h` },
          {
            icon: Gauge,
            label: "Pressure",
            value: `${number(a.surfacePressure, 0)} hPa`,
          },
          {
            icon: Cloud,
            label: "Cloud cover",
            value: `${number(a.cloudCover, 0)}%`,
          },
        ].map(({ icon: Icon, label, value }) => (
          <div key={label}>
            <Icon size={15} />
            <span>{label}</span>
            <strong>{value}</strong>
          </div>
        ))}
      </div>
      <p className="fine-print">
        {number(data.current.temperature)}°C · Large-scale rain:{" "}
        {number(data.current.rain)} mm. Rainfall totals include showers.
      </p>
    </section>
  );
}
