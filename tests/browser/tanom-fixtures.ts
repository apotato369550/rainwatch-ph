export const environmentFixture = (code=0, missing=false) => ({
  latitude:9.85,longitude:123.45,fetchedAt:"2026-10-31T02:00:00Z",observedAt:"2026-10-31T02:00:00Z",
  temperature:code===0?35:27,maximum:36,precipitation:code>=51?4:0,dailyRain:code>=51?20:0,
  probability:code>=51?90:10,weatherCode:code,soilMoisture:missing?null:.31,soilTemperature:missing?null:26,elevation:780,
  soilTime:missing?null:"2026-10-31T02:00:00Z",
  days:Array.from({length:7},(_,i)=>({date:"2026-11-0"+(i+1),heat:missing&&i===2?null:30+i%3,rain:code>=51?i*3:0})),
});
export const climateFixture = {
  fetchedAt:"2026-10-31T02:00:00Z",source:"ERA5 · 1991–2020",
  months:Array.from({length:12},(_,i)=>({date:"2000-"+String(i+1).padStart(2,"0"),heat:24+i%3,rain:100,partial:false})),
};
export const outlookFixture = {
  fetchedAt:"2026-10-31T02:00:00Z",source:"ECMWF SEAS5 ensemble mean · regional, 36 km",
  months:Array.from({length:7},(_,i)=>({date:"2026-"+String(i+4).padStart(2,"0"),heat:27+i%2,rain:120,partial:i===0})),
};
