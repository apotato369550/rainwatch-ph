"use client";
import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { ArrowUpRight, Bean, CalendarDays, Check, ChevronRight, Cloud, CloudLightning, CloudRain, CloudSun, Compass, Droplets, Info, Layers, Leaf, LocateFixed, MapPin, Mountain, RefreshCw, Snowflake, Sprout, Sun, Thermometer, Wheat } from "lucide-react";
import { climateSchema, environmentSchema, type Point } from "@/lib/tanom/contracts";
import { defaultPoint, findMunicipality, municipalities, representativePoint } from "@/lib/tanom/geography";
import { weatherKind } from "@/lib/tanom/calculations";
import { cropMatches } from "@/lib/tanom/crops";
import { useResource } from "./tanom-hooks";
import { TanomChart } from "./tanom-chart";
import "./tanom.css";
import { Analysis } from "./tanom/analysis";
const Map = dynamic(()=>import("./tanom-map"),{ssr:false,loading:()=> <div className="cebu-map map-loading" role="status">Loading Cebu map…</div>});
const icons = {sun:Sun,partly:CloudSun,cloud:Cloud,rain:CloudRain,storm:CloudLightning,snow:Snowflake,unknown:Info};
const cropIcons = {leaf:Leaf,fruit:Sprout,grain:Wheat,bean:Bean};
export function Tanom({page="home"}:{page?:string}) {
  const [ceb,setCeb]=useState(false);
  const [point,setPoint]=useState<Point>(defaultPoint);
  const [gpsState,setGpsState]=useState<"idle"|"loading"|"denied"|"outside"|"timeout"|"unavailable">("idle");
  const [accuracy,setAccuracy]=useState<number|null>(null);
  const [planning,setPlanning]=useState(page==="planning"||page==="growing");
  const [tab,setTab]=useState<"3"|"6"|"annual">("3");
  const planningRef=useRef<HTMLElement>(null);
  const gpsRequest=useRef(0);
  const t=(en:string,ce:string)=>ceb?ce:en;
  useEffect(()=>{document.documentElement.lang=ceb?"ceb":"en";},[ceb]);
  useEffect(()=>{
    if(!planningRef.current)return;
    const observer=new IntersectionObserver(entries=>{if(entries.some(e=>e.isIntersecting)){setPlanning(true);observer.disconnect();}},{rootMargin:"250px"});
    observer.observe(planningRef.current);return()=>observer.disconnect();
  },[]);
  useEffect(()=>()=>{gpsRequest.current++;},[]);
  const params=new URLSearchParams({lat:String(point.lat),lon:String(point.lon)}).toString();
  const environment=useResource("/api/environment?"+params,environmentSchema,600000);
  const climate=useResource(planning?"/api/climate-profile?"+params:null,climateSchema);
  const outlook=useResource(planning&&tab!=="annual"?"/api/outlook?"+params:null,climateSchema);
  const data=environment.data;
  const municipality=findMunicipality(point);
  const weather=weatherKind(data?.weatherCode??null);
  const HeatIcon=icons[weather];
  const WaterIcon=weather==="rain"||weather==="storm"||weather==="snow"?icons[weather]:weather==="unknown"?Info:CloudSun;
  const condition = {
    sun:t("Clear skies","Hayag ang langit"),partly:t("Partly cloudy","Medyo panganod"),cloud:t("Cloudy skies","Dag-om"),
    rain:t("Rainfall","Nag-ulan"),storm:t("Thunderstorm","Dalogdog ug ulan"),snow:t("Snow conditions","Kondisyon sa niyebe"),unknown:t("Condition unavailable","Walay datos sa kondisyon"),
  }[weather];
  const matches=cropMatches(climate.data,data?.elevation??null);
  const fmt=(n:number|null|undefined,digits=1)=>n===null||n===undefined?t("Unavailable","Walay datos"):n.toFixed(digits);
  const dateTime=(s:string)=>new Date(s).toLocaleString(ceb?"ceb-PH":"en-PH",{month:"short",day:"numeric",hour:"numeric",minute:"2-digit",timeZone:"Asia/Manila"});
  function select(p:Point) {
    if(!findMunicipality(p))return;
    gpsRequest.current++;setPoint(p);setAccuracy(null);setGpsState("idle");
  }
  function gps() {
    if(!navigator.geolocation){setGpsState("unavailable");return;}
    const id=++gpsRequest.current;
    setGpsState("loading");
    navigator.geolocation.getCurrentPosition(result=>{
      if(id!==gpsRequest.current)return;
      const p={lat:result.coords.latitude,lon:result.coords.longitude};
      if(!findMunicipality(p)){setGpsState("outside");return;}
      setPoint(p);setAccuracy(result.coords.accuracy);setGpsState("idle");
    },error=>{if(id===gpsRequest.current)setGpsState(error.code===1?"denied":error.code===3?"timeout":"unavailable");},{enableHighAccuracy:true,timeout:15000,maximumAge:60000});
  }
  const season=tab==="annual"?climate:outlook;
  const months=(season.data?.months??[]).slice(0,tab==="annual"?12:Number(tab));
  const gpsMessages={
    idle:"",loading:t("Finding your location…","Gipangita ang imong lokasyon…"),
    denied:t("Location permission denied. Choose a place on the map or list.","Wala gitugotan ang GPS. Pagpili sa mapa o listahan."),
    outside:t("This location is outside Cebu land boundaries. Choose your farm on the map.","Ang lokasyon gawas sa Cebu. Pilia ang uma sa mapa."),
    timeout:t("GPS timed out. You can still select a location manually.","Nahurot ang oras sa GPS. Makapili gihapon ka sa mapa."),
    unavailable:t("GPS is unavailable. Use the map or municipality list.","Dili magamit ang GPS. Gamita ang mapa o listahan."),
  };
  return <div className="tanom">
    <a className="skip" href="#farm">{t("Skip to content","Adto sa sulod")}</a>
    <header className="tanom-header">
      <a href="#farm" className="tanom-brand" aria-label="TANOM home"><svg width="48" height="48" viewBox="0 0 64 64" fill="none" aria-hidden="true"><path d="M18 18a14 14 0 0 1 28 0" stroke="#B44F13" strokeWidth="5" strokeLinecap="round"/><path d="M6 25h52M12 34h40M19 43h26" stroke="#936B17" strokeWidth="4" strokeLinecap="round"/><path d="M32 25v19c0 8-9 9-9 15" stroke="#176080" strokeWidth="5" strokeLinecap="round"/></svg><span>TANOM</span></a>
      <div className="header-right">
      <button className="language" role="switch" aria-label="Cebuano" aria-checked={ceb} onClick={()=>setCeb(!ceb)}><span lang="en">EN</span><span className="switch-track"><span className="switch-thumb"/></span><span lang="ceb">CEB</span></button></div>
    </header>
    <nav className="page-nav" aria-label={t("Main navigation","Pangunang nabigasyon")}><div>{[["/","home",t("Heat, Water & Soil","Kainit, Tubig ug Yuta")],["/conditions","conditions",t("Conditions","Kondisyon")],["/growing","growing",t("AI & Growing","AI ug Pagtanom")],["/planning","planning",t("Seasonal Planning","Plano sa Panahon")],["/ml","ml",t("ML · Coming soon","ML · Umaabot")]].map(([href,id,label])=><a key={href} href={href} aria-current={page===id?"page":undefined}>{label}</a>)}</div></nav><main id="farm">
      <section className="intro page-intro">
        <div><h1>{page==="home"?t("Heat, water & soil","Kainit, tubig ug yuta"):page==="conditions"?t("Your weekly conditions","Kondisyon sa semana"):page==="growing"?t("Growing with your land","Pagtanom sa imong yuta"):page==="planning"?t("Plan for the season","Plano alang sa panahon"):t("ML weather predictions","ML nga forecast sa panahon")}</h1></div>
      </section>
      {environment.loading&&<p className="status-note" role="status">{t("Loading conditions for this location…","Gikarga ang kondisyon sa lugar…")}</p>}
      {environment.error&&<div className="status-note error-note" role="alert"><Info size={20} aria-hidden="true"/><p>{data?t("Refresh failed. These conditions may be stale.","Napakyas ang update. Basin daan na kini nga datos."):t("Weather is unavailable. Map and planning remain accessible.","Walay datos sa panahon. Magamit gihapon ang mapa ug plano.")}</p><button onClick={environment.retry}><RefreshCw size={16} aria-hidden="true"/>{t("Retry","Sulayi pag-usab")}</button></div>}
      <div className={page==="home"?"home-layout":undefined}><div className="conditions-column">
      
      {page==="home"&&<>
      <section className="cards" aria-label={t("Today's conditions","Kondisyon karon")}>
        <article className="condition-card heat"><div className="card-top"><span className="card-label"><Thermometer size={18} aria-hidden="true"/>{t("HEAT","KAINIT")}</span><HeatIcon size={48} strokeWidth={1.5} aria-hidden="true"/></div><p className="card-value">{fmt(data?.temperature)}{data?.temperature!=null&&<small>°C</small>}</p><h3>{condition}</h3><div className="card-bottom"><Sun size={18} aria-hidden="true"/>{t("Today's high","Kinatas-an karon")} <b>{fmt(data?.maximum)}{data?.maximum!=null?" °C":""}</b></div></article>
        <article className="condition-card water"><div className="card-top"><span className="card-label"><Droplets size={18} aria-hidden="true"/>{t("WATER","TUBIG")}</span><WaterIcon size={48} strokeWidth={1.5} aria-hidden="true"/></div><p className="card-value">{fmt(data?.dailyRain)}{data?.dailyRain!=null&&<small>mm</small>}</p><h3>{t("Today's rainfall forecast","Gipaabot nga ulan karon")}</h3><div className="card-bottom"><CloudRain size={18} aria-hidden="true"/>{t("Peak hourly chance","Kinatas-ang tsansa matag oras")} <b>{fmt(data?.probability,0)}{data?.probability!=null?"%":""}</b></div></article>
        <article className="condition-card soil"><div className="card-top"><span className="card-label"><Layers size={18} aria-hidden="true"/>{t("SOIL","YUTA")}</span>{data?.soilMoisture!=null?<Layers size={48} strokeWidth={1.5} aria-hidden="true"/>:<Info size={48} strokeWidth={1.5} aria-hidden="true"/>}</div><p className="card-value">{fmt(data?.soilMoisture,3)}{data?.soilMoisture!=null&&<small>m³/m³</small>}</p><h3>{t("Modeled surface moisture","Kaumog sa nawong sa yuta · modelo")}</h3><div className="card-bottom"><Thermometer size={18} aria-hidden="true"/>{t("Surface temperature","Temperatura sa nawong")} <b>{fmt(data?.soilTemperature)}{data?.soilTemperature!=null?" °C":""}</b></div></article>
      </section>
      </>}
      </div>{page!=="ml"&&<div className={page==="conditions"?"workspace":page==="home"?"workspace home-map":"workspace workspace-single"}>
        {page==="conditions"&&<section className="tanom-panel chartpanel"><div className="section-title"><div><p className="eyeline">{t("PLAN THE WEEK","PLANO SA SEMANA")}</p><h2>{t("Next seven days","Sunod pito ka adlaw")}</h2></div><CalendarDays size={25} aria-hidden="true"/></div><p>{t("Daily maximum temperature and total rainfall. Philippine time.","Kinatas-ang temperatura ug kinatibuk-ang ulan matag adlaw. Oras sa Pilipinas.")}</p>
          {data?<><TanomChart rows={data.days} ceb={ceb}/><h3>Modeled surface moisture · 0–1 cm</h3><details><summary>Hourly moisture · m³/m³ · Philippine time</summary><div className="table-scroll"><table><thead><tr><th>Time (PHT)</th><th>m³/m³</th></tr></thead><tbody>{data.hourlySoil?.map(row=><tr key={row.time}><td>{dateTime(row.time)}</td><td>{row.soilMoisture?.toFixed(3)??"—"}</td></tr>)}</tbody></table></div></details></>:<div className="chart-empty">{t("Forecast appears here when weather data is available.","Makita dinhi ang forecast kon adunay datos.")}</div>}
          <div className="chart-caption"><Info size={16} aria-hidden="true"/>{t("Model forecasts, not measurements from your farm.","Forecast sa modelo, dili sukod gikan sa imong uma.")}</div>
        </section>
        }<section className="tanom-panel map-panel" id="area"><div className="section-title"><div><h2>{t("Find your Farm","Pangitaa ang imong Uma")}</h2></div><Compass size={26} aria-hidden="true"/></div>
          <p>{t("Click the land or a settlement dot to choose your farm. Zoom in to see named settlements; coverage is incomplete.","I-klik ang yuta o tuldok sa pagpili sa uma. I-zoom aron makita ang mga lugar; dili kompleto ang datos.")}</p>
          
          <button onClick={gps} disabled={gpsState==="loading"}><LocateFixed size={18} aria-hidden="true"/>{t("Use my location","Akong lokasyon")}</button>{gpsState!=="idle"&&<p className="status-note" role="status">{gpsMessages[gpsState]}</p>}
          <Map point={point} onSelect={select} ceb={ceb}/>
          <section className="locationbar" aria-label={t("Selected location","Gipiling lokasyon")}>
        <div className="location-heading"><span className="location-pin"><MapPin size={23} aria-hidden="true"/></span><div><h2>{municipality?.properties.name??"Cebu"}</h2><p>{point.lat.toFixed(4)}° N · {point.lon.toFixed(4)}° E {accuracy!==null&&<span> · GPS ±{Math.round(accuracy)} m</span>}</p></div></div>
        <div className="location-actions"><span>{data?t("Weather time: ","Oras sa panahon: ")+dateTime(data.observedAt)+" PHT":t("Live model data","Live nga datos sa modelo")}</span></div>
      </section>
          <div className="map-controls">
          <label htmlFor="municipality">{t("Municipality / city","Lungsod / siyudad")}</label><select id="municipality" value={municipality?.properties.id??""} onChange={e=>{const f=municipalities.find(m=>m.properties.id===e.target.value);if(f)select(representativePoint(f));}}>
            
            {municipalities.map(f=><option key={f.properties.id} value={f.properties.id}>{f.properties.name}</option>)}
          </select></div>
          <div className="terrain-context"><Mountain size={20} aria-hidden="true"/><span>{t("Terrain elevation","Kahabogon sa yuta")}</span><strong>{fmt(data?.elevation,0)}{data?.elevation!=null?" m":""}</strong></div>
        </section>
      </div>
      }
      </div>{page==="growing"&&<>
      <Analysis key={`${point.lat},${point.lon},${ceb}`} point={point} ceb={ceb}/>
      <section className="cropsection" ref={planningRef}><div className="section-title"><div><p className="eyeline">{t("GROW WITH YOUR SURROUNDINGS","PAGTANOM SUMALA SA PALIBOT")}</p><h2>{t("Crops to explore","Mga tanom nga susihon")}</h2></div><Leaf size={28} aria-hidden="true"/></div>
        <p>{t("Preliminary climate and elevation matches—not planting recommendations.","Inisyal nga pagpares sa klima ug kahabogon—dili rekomendasyon sa pagtanom.")}</p>
        {climate.loading&&planning&&<p className="status-note" role="status">{t("Loading the 1991–2020 climate profile for crop matching…","Gikarga ang klima sa 1991–2020 alang sa pagpares…")}</p>}
        {climate.error&&<div className="status-note"><p>{t("Historical climate is unavailable; crop matches cannot be calculated.","Walay datos sa klima; dili makakwenta sa pagpares.")}</p><button onClick={climate.retry}>{t("Retry climate data","Sulayi pag-usab ang klima")}</button></div>}
        {matches&&matches.length>0?<div className="crop-grid">{matches.map((crop,i)=>{const Icon=cropIcons[crop.icon];return <article className="crop-card" key={crop.id}><div className="crop-top"><Icon size={34} strokeWidth={1.6} aria-hidden="true"/><span>0{i+1}</span></div><h3>{ceb?crop.ceb:crop.name}</h3><p>{t("Broad climate match","Lapad nga pagpares sa klima")}</p><ul><li><Check size={15} aria-hidden="true"/>{t("Temperature","Temperatura")}: {crop.temperature.toFixed(1)} °C</li><li><Check size={15} aria-hidden="true"/>{t("Annual rain","Tinuig nga ulan")}: {Math.round(crop.rainfall)} mm</li><li><Check size={15} aria-hidden="true"/>{t("Elevation","Kahabogon")}: {fmt(data?.elevation,0)} m</li></ul><p className="microcopy">{t("Compared against EcoCrop tolerances; not a season or cultivar assessment.","Gitandi sa EcoCrop; dili pagtimbang sa panahon o matang sa tanom.")}</p><a href={`https://ecocrop.apps.fao.org/ecocrop/srv/en/dataSheet?id=${crop.id}`} target="_blank" rel="noreferrer">{t("Crop requirements","Kinahanglan sa tanom")}<ArrowUpRight size={15} aria-hidden="true"/></a></article>;})}</div>:!climate.loading&&<p className="status-note">{matches?t("No catalog crops meet all available climate/elevation limits. No unsuitable crops have been added.","Walay tanom sa katalogo nga nahiuyon sa datos."):t("Complete climate and elevation data are needed for crop matches.","Gikinahanglan ang kompleto nga klima ug kahabogon.")}</p>}
        <p className="limitations"><Info size={18} aria-hidden="true"/>{t("Soil type, pH, fertility, slope, drainage, irrigation and cultivar suitability are unknown. Current weather is short-term context, not proof a crop will grow well.","Wala mahibaloi ang matang sa yuta, pH, katambok, bakilid, drainage, irigasyon ug cultivar. Ang panahon karon dili pamatuod sa maayong pagtubo.")}</p>
      </section>
      </>}
      {page==="planning"&&<section className="tanom-panel season"><div className="section-title"><div><p className="eyeline">{t("LOOK A LITTLE FURTHER","TAN-AW SA UMAABOT")}</p><h2>{t("Seasonal planning","Plano sa panahon")}</h2></div><CalendarDays size={28} aria-hidden="true"/></div>
        <div className="season-tabs" role="group" aria-label={t("Planning period","Gidugayon sa plano")}>{(["3","6","annual"] as const).map(value=><button key={value} aria-pressed={tab===value} onClick={()=>{setPlanning(true);setTab(value);}}>{value==="annual"?t("Annual climate profile","Tinuig nga klima"):value+" "+t("months","ka bulan")}<ChevronRight size={16} aria-hidden="true"/></button>)}</div>
        <h3>{tab==="annual"?t("Historical climate profile—not a forecast","Kasaysayan sa klima—dili forecast"):t("Regional seasonal outlook","Rehiyonal nga forecast")}</h3>
        <p>{tab==="annual"?t("1991–2020 ERA5 averages: monthly mean temperature and average monthly rainfall totals.","1991–2020 ERA5: kasagarang temperatura ug kinatibuk-ang ulan matag bulan."):t("ECMWF SEAS5 ensemble mean. Approximately 36 km resolution; not bias-corrected. Regional estimates, not precise farm predictions.","ECMWF SEAS5 ensemble mean. Mga 36 km; dili bias-corrected. Rehiyonal, dili tukma nga forecast sa uma.")}</p>
        {season.loading&&planning&&<p className="status-note" role="status">{t("Loading planning data…","Gikarga ang datos sa plano…")}</p>}
        {season.error&&<div className="status-note error-note" role="alert"><p>{t("Planning data is unavailable. Current weather is unaffected.","Walay datos sa plano. Dili apektado ang panahon karon.")}</p><button onClick={season.retry}>{t("Retry","Sulayi pag-usab")}</button></div>}
        {months.length>0&&<><TanomChart rows={months.map(m=>({...m,date:m.date.length===7?m.date+"-01":m.date}))} ceb={ceb} monthly/><div className="monthly-summaries">{months.map(m=><div key={m.date}><strong>{new Date(m.date+"-01T00:00:00+08:00").toLocaleDateString(ceb?"ceb-PH":"en-PH",{month:"short",...(tab==="annual"?{}:{year:"numeric"}),timeZone:"Asia/Manila"})}</strong><span>{fmt(m.heat)} °C</span><span>{fmt(m.rain,0)} mm</span>{m.partial&&<small>{t("Partial month","Dili kompleto nga bulan")}</small>}</div>)}</div><p className="microcopy">{season.data?.source} · {t("Retrieved","Gikuha")}: {season.data&&dateTime(season.data.fetchedAt)} PHT</p></>}
        <p className="limitations"><Info size={18} aria-hidden="true"/>{tab==="annual"?t("Reanalysis is modeled history, not a local weather-station record.","Ang reanalysis modelo sa kasaysayan, dili lokal nga weather station."):t("Long-range forecasts are uncertain. No farm-level confidence or above/below-normal claims are inferred. Partial months are labeled, not extrapolated.","Dili sigurado ang dugay nga forecast. Ang kulang nga bulan gimarkahan ug wala gipuno.")}</p>
      </section>
      }{page==="ml"&&<section className="tanom-panel"><h2>ML Weather Predictions</h2><p>Coming soon. No ML predictions are available yet.</p></section>}<footer><div className="footer-name"><Sprout size={20} aria-hidden="true"/>TANOM <span>· {t("A clearer view of your growing world.","Mas klaro nga pagtan-aw sa uma.")}</span></div><p><a href="https://open-meteo.com/">Open-Meteo</a> · ECMWF / ERA5 · Copernicus DEM · <a href="/cebu-boundaries-LICENSE.md">Boundary attribution</a></p><p>{t("Modeled conditions, not farm sensors or official warnings. Cebuano wording awaits local-speaker review.","Kondisyon sa modelo, dili sensor sa uma o opisyal nga pahimangno. Ang Cebuano kinahanglan repasohon sa lokal nga mamumulong.")}</p></footer>
    </main>
  </div>;
}
