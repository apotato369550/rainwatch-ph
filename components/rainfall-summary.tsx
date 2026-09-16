import { ArrowUpRight, Droplets } from "lucide-react";
import type { RainfallRisk } from "@/lib/types";
import { number } from "@/lib/format";
export function RainfallSummary({ data }: { data: RainfallRisk }) {
  return (
    <div className="summary-grid">
      {[
        {
          label: "Next 3 hours",
          value: data.next3hRainfall,
          caption: "Near-term accumulation",
        },
        {
          label: "Next 6 hours",
          value: data.next6hRainfall,
          caption: "Short-range accumulation",
        },
        {
          label: "Next 24 hours",
          value: data.next24hRainfall,
          caption: "Full-day accumulation",
        },
      ].map((item) => (
        <section className="metric" key={item.label}>
          <div className="section-heading">
            <h2>{item.label}</h2>
            <Droplets size={17} />
          </div>
          <div className="metric-value">
            {number(item.value)} <span>mm</span>
          </div>
          <p>{item.caption}</p>
        </section>
      ))}
      <section className="metric probability">
        <div className="section-heading">
          <h2>Chance of rain</h2>
          <ArrowUpRight size={18} />
        </div>
        <div className="metric-value">
          {number(data.precipitationProbability, 0)}
          <span>%</span>
        </div>
        <p>Highest hourly probability · next 24h</p>
      </section>
    </div>
  );
}
