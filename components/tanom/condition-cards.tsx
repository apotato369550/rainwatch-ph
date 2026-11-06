import type { Environment } from "@/lib/tanom/contracts";
import { weatherKind } from "@/lib/tanom/calculations";
import { rainBand, soilBand, elevationBand } from "@/lib/tanom/card-states";
import { ConditionArt } from "./condition-art";
export function ConditionCards({data, ceb}: {data: Environment | null; ceb: boolean}) {
  const t = (en: string, ce: string) => ceb ? ce : en;
  const unavailable = t("Unavailable", "Walay datos");
  const fmt = (value: number | null | undefined, unit: string, digits = 1) => value == null ? unavailable : value.toFixed(digits) + " " + unit;
  const heat = ["sun","partly","cloud","rain","storm","snow"].indexOf(weatherKind(data?.weatherCode ?? null));
  const rain = rainBand(data?.dailyRain), soil = soilBand(data?.soilMoisture), elevation = elevationBand(data?.elevation);
  const cards = [
    {kind:"heat", title:t("Heat","Kainit"), band:heat, value:fmt(data?.temperature,"°C"), label:[t("Clear skies","Hayag ang langit"),t("Partly cloudy","Medyo panganod"),t("Cloudy","Dag-om"),t("Rainfall","Nag-ulan"),t("Thunderstorm","Dalogdog ug ulan"),t("Snow conditions","Kondisyon sa niyebe")][heat], detail:t("Today's high","Kinatas-an karon")+": "+fmt(data?.maximum,"°C")},
    {kind:"water", title:t("Water","Tubig"), band:rain, value:fmt(data?.dailyRain,"mm"), label:[t("No rain forecast","Walay gipaabot nga ulan"),t("Small rainfall total","Gamay nga ulan"),t("Moderate rainfall total","Kasagarang gidaghanon sa ulan"),t("Large rainfall total","Daghang ulan"),t("Very large rainfall total","Daghan kaayong ulan")][rain], detail:t("Peak hourly chance","Kinatas-ang tsansa matag oras")+": "+fmt(data?.probability,"%",0)},
    {kind:"soil", title:t("Soil","Yuta"), band:soil, value:fmt(data?.soilMoisture,"m³/m³",3), label:["<0.100 m³/m³","0.100–<0.300 m³/m³","0.300–<0.450 m³/m³","≥0.450 m³/m³"][soil], detail:t("Modeled surface moisture · 0–1 cm. Surface temperature","Kaumog sa nawong · modelo · 0–1 cm. Temperatura")+": "+fmt(data?.soilTemperature,"°C")},
    {kind:"elevation", title:t("Elevation","Kahabogon"), band:elevation, value:fmt(data?.elevation,"m",0), label:["<200 m","200–<500 m","500–<1,000 m","≥1,000 m"][elevation], detail:t("Modeled terrain height—not slope or drainage.","Modelo sa kahabogon—dili bakilid o drainage.")}
  ];
  return <><section className="cards" aria-label={t("Today's conditions","Kondisyon karon")}>{cards.map(card=><article key={card.kind} className={"condition-card "+card.kind}><h2 className="card-label">{card.title}</h2><ConditionArt kind={card.kind} band={card.band}/><p className="card-value">{card.value}</p><h3>{card.label ?? unavailable}</h3><p className="card-subtitle">{card.detail}</p></article>)}</section><p className="microcopy card-disclaimer">{t("Illustration bands are visual ranges, not official rainfall classifications, soil-health assessments, or crop recommendations.","Ang mga hulagway biswal nga han-ay lamang, dili opisyal nga klasipikasyon sa ulan, panglawas sa yuta, o rekomendasyon sa tanom.")}</p></>;
}
