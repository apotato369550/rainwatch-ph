import { BrainCircuit, Info } from "lucide-react";
import type { RainfallRisk } from "@/lib/types";
import { number } from "@/lib/format";
export function MlForecast({ data }: { data: RainfallRisk }) {
  const ml = data.mlForecast;
  if (ml.correctedNext6h === null) return <section className="panel ml-panel"><div className="section-heading"><h2>ML forecast correction</h2><BrainCircuit size={17}/></div><p>ML model is still collecting sufficient historical data. Raw Open-Meteo forecasts are being shown.</p></section>;
  const difference = ml.correctedNext6h - ml.rawNext6h;
  return <section className="panel ml-panel"><div className="section-heading"><h2>Rainfall forecast</h2><BrainCircuit size={17}/></div><div className="ml-values"><div><span>Open-Meteo · next 6h</span><strong>{number(ml.rawNext6h)} <small>mm</small></strong></div><div><span>ML-adjusted · next 6h</span><strong>{number(ml.correctedNext6h)} <small>mm</small></strong></div><div><span>Difference</span><strong>{difference >= 0 ? "+" : ""}{number(difference)} <small>mm</small></strong></div></div><p className="fine-print">Experimental ML-adjusted rainfall forecast · {ml.modelName} {ml.modelVersion}</p><details><summary><Info size={14}/> What does this mean?</summary><p>The model learns systematic differences between previous weather forecasts and later historical-weather rainfall estimates. It does not independently simulate weather.</p></details></section>;
}
