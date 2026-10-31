import type { ChartDay } from "./contracts";
export function weatherKind(code: number | null) {
  if (code === null) return "unknown";
  if (code >= 95) return "storm";
  if ([51,53,55,56,57,61,63,65,66,67,80,81,82].includes(code)) return "rain";
  if ([71,73,75,77,85,86].includes(code)) return "snow";
  if ([3,45,48].includes(code)) return "cloud";
  return code === 0 ? "sun" : "partly";
}
export function monthly(rows: ChartDay[]) {
  const groups = new Map<string, ChartDay[]>();
  for (const row of rows) {
    const key = row.date.slice(0,7);
    groups.set(key, [...(groups.get(key) ?? []), row]);
  }
  return [...groups].map(([date, days]) => {
    const count = new Date(Date.UTC(Number(date.slice(0,4)), Number(date.slice(5,7)), 0)).getUTCDate();
    const heat = days.every(d => d.heat !== null) ? days.reduce((s,d) => s + d.heat!,0)/days.length : null;
    const rain = days.every(d => d.rain !== null) ? days.reduce((s,d) => s + d.rain!,0) : null;
    return { date, heat, rain, partial: days.length !== count };
  });
}
export function normals(rows: ChartDay[], years = 30) {
  const months = monthly(rows);
  return Array.from({length:12}, (_,i) => {
    const key = String(i+1).padStart(2,"0");
    const group = months.filter(m => m.date.endsWith("-"+key));
    const complete = group.length === years && group.every(m => !m.partial);
    return {
      date: "2000-"+key,
      heat: complete && group.every(m => m.heat !== null) ? group.reduce((s,m)=>s+m.heat!,0)/years : null,
      rain: complete && group.every(m => m.rain !== null) ? group.reduce((s,m)=>s+m.rain!,0)/years : null,
      partial: !complete,
    };
  });
}
