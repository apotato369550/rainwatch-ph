"use client";
import { useState } from "react";
import dynamic from "next/dynamic";
import { Compass, LocateFixed, MapPin } from "lucide-react";
import type { Point } from "@/lib/tanom/contracts";
import {
  findMunicipality,
  areas,
  municipalities,
  representativePoint,
} from "@/lib/tanom/geography";
const Map = dynamic(() => import("../tanom-map"), {
  ssr: false,
  loading: () => <div className="cebu-map" aria-hidden="true" />,
});
export function LocationFinder({
  point,
  select,
  gps,
  gpsState,
  gpsMessage,
  accuracy,
  ceb,
}: {
  point: Point;
  select: (point: Point) => void;
  gps: () => void;
  gpsState: string;
  gpsMessage: string;
  accuracy: number | null;
  ceb: boolean;
}) {
  const t = (en: string, ce: string) => (ceb ? ce : en);
  const municipality = findMunicipality(point);
  const selectedAreaId = municipality?.properties.areaId ?? "";
  const [previousPoint, setPreviousPoint] = useState(point);
  const [areaId, setAreaId] = useState(selectedAreaId);
  if (point !== previousPoint) {
    setPreviousPoint(point);
    setAreaId(selectedAreaId);
  }
  const filtered = municipalities.filter(
    (item) => item.properties.areaId === areaId,
  );
  return (
    <section className="tanom-panel map-panel" id="area">
      <div className="section-title">
        <div>
          <h2>{t("Find your Farm", "Pangitaa ang imong Uma")}</h2>
        </div>
        <Compass size={26} aria-hidden="true" />
      </div>
      <div className="map-controls">
        <label htmlFor="province-area">
          {t("Province / area", "Probinsya / lugar")}
        </label>
        <select
          id="province-area"
          value={areaId}
          onChange={(e) => setAreaId(e.target.value)}
        >
          {areas.map((area) => (
            <option key={area.id} value={area.id}>
              {area.name}
            </option>
          ))}
        </select>
        <label htmlFor="municipality">
          {t("Municipality / city", "Lungsod / siyudad")}
        </label>
        <select
          id="municipality"
          value={
            municipality?.properties.areaId === areaId
              ? municipality.properties.id
              : ""
          }
          onChange={(e) => {
            const f = municipalities.find(
              (m) => m.properties.id === e.target.value,
            );
            if (f) select(representativePoint(f));
          }}
        >
          <option value="" disabled>
            {t("Choose municipality / city", "Pilia ang lungsod / siyudad")}
          </option>
          {filtered.map((f) => (
            <option key={f.properties.id} value={f.properties.id}>
              {f.properties.name}
            </option>
          ))}
        </select>
      </div>

      <button onClick={gps} disabled={gpsState === "loading"}>
        <LocateFixed size={18} aria-hidden="true" />
        {t("Use my location", "Akong lokasyon")}
      </button>
      {gpsState !== "idle" && (
        <p className="status-note" role="status">
          {gpsMessage}
        </p>
      )}
      <Map areaId={areaId} point={point} onSelect={select} ceb={ceb} />
      <section
        className="locationbar"
        aria-label={t("Selected location", "Gipiling lokasyon")}
      >
        <div className="location-heading">
          <span className="location-pin">
            <MapPin size={23} aria-hidden="true" />
          </span>
          <div>
            <h2>{municipality?.properties.name ?? "Philippines"}</h2>
            <p>
              {point.lat.toFixed(4)}° N · {point.lon.toFixed(4)}° E{" "}
              {accuracy !== null && (
                <span> · GPS ±{Math.round(accuracy)} m</span>
              )}
            </p>
          </div>
        </div>
      </section>
    </section>
  );
}
