import { Info } from "lucide-react";
import type { RainfallRisk } from "@/lib/types";
import { severityColors, number } from "@/lib/format";
export function StressGauge({ data }: { data: RainfallRisk }) {
  const color = severityColors[data.stressLevel];
  return (
    <section className="panel stress">
      <div className="section-heading">
        <h2>Rainfall Stress</h2>
        <span className="tag">Experimental</span>
      </div>
      <div className="stress-main">
        <div
          className="score-ring"
          style={{
            background: `conic-gradient(${color} ${data.stressScore}%, #29343a 0)`,
          }}
        >
          <div>
            <strong>{data.stressScore}</strong>
            <span>out of 100</span>
          </div>
        </div>
        <div>
          <span className="level" style={{ color, background: `${color}15` }}>
            {data.stressLevel}
          </span>
          <p>
            {data.stressScore < 30
              ? "Limited rainfall stress in the forecast."
              : "Conditions are contributing to rainfall stress."}
          </p>
          <span className="fine-print">
            A heuristic, not an official warning
          </span>
        </div>
      </div>
      <div className="severity-scale">
        {Object.entries(severityColors).map(([level, c]) => (
          <div key={level}>
            <i style={{ background: c }} />
            <span>{level}</span>
          </div>
        ))}
      </div>
      <div className="factors">
        <h3>
          {data.stressScore >= 50
            ? "Why is stress elevated?"
            : "What’s shaping the outlook?"}
        </h3>
        <div className="factor-grid">
          {data.contributingFactors.slice(0, 3).map((f) => (
            <div className="factor" key={f.name}>
              <div className="factor-label">
                <h4>{f.name}</h4>
                <span>
                  {f.points.toFixed(1)} / {f.maxPoints} pts
                </span>
              </div>
              <div className="factor-track" aria-hidden="true">
                <i style={{ width: `${(f.points / f.maxPoints) * 100}%` }} />
              </div>
              <p>
                {f.value === null
                  ? "Unavailable; contributes zero. The score may be understated."
                  : f.points > 0
                    ? f.description
                    : "This factor adds no points to the current indicator."}
              </p>
            </div>
          ))}
        </div>
      </div>
      <details>
        <summary>
          <Info size={14} /> How is this calculated?
        </summary>
        <p>
          Each input is clamped to 0–1, multiplied by its weight, then summed
          and rounded. Thresholds are experimental, not locally calibrated.
        </p>
        <ul>
          <li>6h rain / 50 mm × 35</li>
          <li>24h rain / 100 mm × 30</li>
          <li>(humidity − 60%) / 40% × 10</li>
          <li>(soil moisture − 0.10) / 0.40 × 15</li>
          <li>CAPE / 2,500 J/kg × 10</li>
        </ul>
        <p>
          Low 0–29 · Moderate 30–49 · Elevated 50–69 · High 70–84 · Extreme
          85–100.
        </p>
        <p>
          Missing inputs contribute zero without reweighting, so the score may
          underestimate stress.
        </p>
        {data.contributingFactors.map((f) => (
          <p key={f.name}>
            {f.name}: {number(f.value, f.unit === "m³/m³" ? 3 : 1)} {f.unit} →{" "}
            {f.points.toFixed(1)} / {f.maxPoints} points
          </p>
        ))}
      </details>
      {data.missingFeatures.length > 0 && (
        <p className="warning">
          Incomplete indicator: {data.missingFeatures.join(", ")} unavailable.
          Score may be understated.
        </p>
      )}
    </section>
  );
}
