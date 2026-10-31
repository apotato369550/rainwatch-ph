"use client";
import { useId } from "react";
import { CartesianGrid,Line,LineChart,ResponsiveContainer,Tooltip,XAxis,YAxis } from "recharts";
import type { ChartDay } from "@/lib/tanom/contracts";
export function TanomChart({rows,ceb,monthly=false}:{rows:ChartDay[];ceb:boolean;monthly?:boolean}) {
  const id=useId();
  const heat=ceb?"Temperatura":"Temperature",rain=ceb?"Ulan":"Rainfall";
  const dateLabel=(date:string)=>new Date(date+"T00:00:00+08:00").toLocaleDateString(ceb?"ceb-PH":"en-PH",{month:"short",...(monthly?{}:{day:"numeric"}),timeZone:"Asia/Manila"});
  const fmt=(n:number|null)=>n===null?"—":n.toFixed(1);
  return <>
    <div className="chart-legend" id={id}><span className="heat-key">{heat} · °C</span><span className="rain-key">{rain} · mm</span></div>
    <div className="tanom-chart" role="img" aria-labelledby={id} aria-label={ceb?"Grap sa temperatura ug ulan; naa sa ubos ang datos":"Temperature and rainfall chart; data table follows"}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={rows} margin={{top:12,right:0,left:0,bottom:8}} accessibilityLayer>
          <CartesianGrid vertical={false} stroke="#d5dee1" strokeDasharray="3 5"/>
          <XAxis dataKey="date" tickFormatter={dateLabel} tickLine={false} minTickGap={16} tick={{fill:"#365566",fontSize:13}}/>
          <YAxis yAxisId="heat" width={42} tickLine={false} axisLine={false} unit="°" tick={{fill:"#923e12",fontSize:13}}/>
          <YAxis yAxisId="rain" width={48} orientation="right" tickLine={false} axisLine={false} unit="" tick={{fill:"#176080",fontSize:13}}/>
          <Tooltip labelFormatter={label=>dateLabel(String(label))} contentStyle={{borderRadius:12,color:"#182f42",background:"#fffdf8"}}/>
          <Line yAxisId="heat" dataKey="heat" name={heat+" °C"} stroke="#ae4811" strokeWidth={3} dot={{r:3}} connectNulls={false} isAnimationActive={false}/>
          <Line yAxisId="rain" dataKey="rain" name={rain+" mm"} stroke="#176080" strokeWidth={3} strokeDasharray="6 4" dot={{r:3}} connectNulls={false} isAnimationActive={false}/>
        </LineChart>
      </ResponsiveContainer>
    </div>
    <details className="chart-data"><summary>{ceb?"Tan-awa ang datos":"View chart data"}</summary><div className="table-scroll"><table><caption>{ceb?"Temperatura ug ulan":"Temperature and rainfall"}</caption><thead><tr><th scope="col">{ceb?"Petsa":"Date"}</th><th scope="col">{heat} °C</th><th scope="col">{rain} mm</th></tr></thead><tbody>{rows.map(r=><tr key={r.date}><th scope="row">{dateLabel(r.date)}</th><td>{fmt(r.heat)}</td><td>{fmt(r.rain)}</td></tr>)}</tbody></table></div></details>
  </>;
}
