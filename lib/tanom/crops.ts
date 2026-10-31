import type { Climate } from "./contracts";
type Range = [number,number];
type Crop = {id:number;name:string;ceb:string;icon:"leaf"|"fruit"|"grain"|"bean";temp:Range;absoluteTemp:Range;rain:Range;absoluteRain:Range;maxElevation:number};
export const crops:Crop[] = [
  {id:554,name:"Cabbage",ceb:"Repolyo",icon:"leaf",temp:[15,24],absoluteTemp:[7,32],rain:[500,1000],absoluteRain:[300,2500],maxElevation:2000},
  {id:1379,name:"Tomato",ceb:"Kamatis",icon:"fruit",temp:[20,27],absoluteTemp:[7,35],rain:[600,1300],absoluteRain:[400,1800],maxElevation:2400},
  {id:2175,name:"Maize",ceb:"Mais",icon:"grain",temp:[18,33],absoluteTemp:[10,47],rain:[600,1200],absoluteRain:[400,1800],maxElevation:4000},
  // EcoCrop 1965's altitude value (50m) conflicts with its descriptive page; retain conservatively rather than silently correcting it.
  {id:1965,name:"Eggplant",ceb:"Talong",icon:"fruit",temp:[20,35],absoluteTemp:[9,40],rain:[1200,1600],absoluteRain:[800,4000],maxElevation:50},
  {id:289,name:"Okra",ceb:"Okra",icon:"leaf",temp:[20,30],absoluteTemp:[12,35],rain:[600,1200],absoluteRain:[300,2500],maxElevation:1000},
  {id:2150,name:"Mung bean",ceb:"Monggos",icon:"bean",temp:[21,36],absoluteTemp:[8,40],rain:[650,900],absoluteRain:[500,1250],maxElevation:2000},
];
const within=(v:number,r:Range)=>v>=r[0]&&v<=r[1];
export function cropMatches(profile:Climate|null,elevation:number|null) {
  if(!profile||profile.months.length!==12||elevation===null||!Number.isFinite(elevation)||
    profile.months.some(m=>m.heat===null||m.rain===null||m.partial))return null;
  const temperature=profile.months.reduce((s,m)=>s+m.heat!,0)/12;
  const rainfall=profile.months.reduce((s,m)=>s+m.rain!,0);
  return crops.filter(c=>within(temperature,c.absoluteTemp)&&within(rainfall,c.absoluteRain)&&elevation<=c.maxElevation)
    .map(c=>({...c,temperature,rainfall,optimalTemp:within(temperature,c.temp),optimalRain:within(rainfall,c.rain),
      score:Number(within(temperature,c.temp))+Number(within(rainfall,c.rain))}))
    .sort((a,b)=>b.score-a.score||a.name.localeCompare(b.name)).slice(0,5);
}
