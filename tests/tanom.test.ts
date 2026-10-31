import test from "node:test";
import assert from "node:assert/strict";
import { findMunicipality, inGeometry, municipalities, representativePoint, defaultPoint } from "../lib/tanom/geography";
import { monthly, normals, weatherKind } from "../lib/tanom/calculations";
import { cropMatches } from "../lib/tanom/crops";
import { environmentSchema } from "../lib/tanom/contracts";
test("Cebu includes all 53 municipalities and independent cities; excludes sea and Manila",()=>{
  assert.equal(municipalities.length,53);
  assert.equal(findMunicipality(defaultPoint)?.properties.name,"Dalaguete");
  assert.equal(findMunicipality({lat:10.3157,lon:123.8854})?.properties.name,"Cebu City");
  assert.equal(findMunicipality({lat:14.6,lon:121}),undefined);
  assert.equal(findMunicipality({lat:10,lon:124.5}),undefined);
  for(const f of municipalities)assert.ok(findMunicipality(representativePoint(f)),f.properties.name);
});
test("polygon holes and multipolygons are respected",()=>{
  const outer=[[0,0],[4,0],[4,4],[0,4],[0,0]],hole=[[1,1],[2,1],[2,2],[1,2],[1,1]];
  assert.equal(inGeometry({lat:1.5,lon:1.5},{type:"Polygon",coordinates:[outer,hole]}),false);
  assert.equal(inGeometry({lat:3,lon:3},{type:"MultiPolygon",coordinates:[[outer,hole]]}),true);
});
test("weather icons follow WMO code, including showers, thunderstorm and missing data",()=>{
  for(const [code,kind] of [[0,"sun"],[1,"partly"],[3,"cloud"],[45,"cloud"],[61,"rain"],[82,"rain"],[95,"storm"],[null,"unknown"]] as const)assert.equal(weatherKind(code),kind);
});
test("monthly aggregation preserves missing values, complete and partial months",()=>{
  const rows=Array.from({length:31},(_,i)=>({date:"2026-01-"+String(i+1).padStart(2,"0"),heat:25,rain:2}));
  assert.deepEqual(monthly(rows),[{date:"2026-01",heat:25,rain:62,partial:false}]);
  assert.equal(monthly(rows.slice(0,4))[0].partial,true);
  assert.equal(monthly([...rows.slice(0,30),{...rows[30],rain:null}])[0].rain,null);
});
test("normals average monthly rainfall totals rather than daily means, including leap years",()=>{
  const rows=[];
  for(let year=2019;year<=2020;year++)for(let month=1;month<=12;month++){
    const count=new Date(Date.UTC(year,month,0)).getUTCDate();
    for(let day=1;day<=count;day++)rows.push({date:year+"-"+String(month).padStart(2,"0")+"-"+String(day).padStart(2,"0"),heat:25,rain:1});
  }
  const profile=normals(rows,2);
  assert.equal(profile[1].rain,28.5);assert.equal(profile[1].heat,25);
  assert.equal(normals(rows.slice(1),2)[0].rain,null);
});
test("crop matches require complete climate and elevation; do not pad unsuitable candidates",()=>{
  const profile={fetchedAt:"now",source:"test",months:Array.from({length:12},(_,i)=>({date:"2000-"+String(i+1).padStart(2,"0"),heat:25,rain:100,partial:false}))};
  assert.equal(cropMatches(profile,null),null);
  assert.equal(cropMatches(null,100),null);
  const matches=cropMatches(profile,100)!;
  assert.ok(matches.length<=5&&matches.length>=3);
  assert.ok(matches.every(m=>m.maxElevation>=100));
  assert.equal(cropMatches({...profile,months:profile.months.map(m=>({...m,heat:60}))},100)?.length,0);
});
test("environment contract rejects fabricated/malformed numeric values",()=>{
  assert.equal(environmentSchema.safeParse({temperature:NaN}).success,false);
});
