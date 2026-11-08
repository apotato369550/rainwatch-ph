"use client";
import dynamic from "next/dynamic";
import { Compass, LocateFixed, MapPin } from "lucide-react";
import type { Point } from "@/lib/tanom/contracts";
import {
  findMunicipality,
  municipalities,
  representativePoint,
} from "@/lib/tanom/geography";
const Map = dynamic(() => import("../tanom-map"), { ssr: false });
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
  return (
    <section className="tanom-panel map-panel" id="area">
      <div className="section-title">
        <div>
          <h2>{t("Find your Farm", "Pangitaa ang imong Uma")}</h2>
        </div>
        <Compass size={26} aria-hidden="true" />
      </div>
      <div className="map-controls">
        <label htmlFor="municipality">
          {t("Municipality / city", "Lungsod / siyudad")}
        </label>
        <select
          id="municipality"
          value={municipality?.properties.id ?? ""}
          onChange={(e) => {
            const f = municipalities.find(
              (m) => m.properties.id === e.target.value,
            );
            if (f) select(representativePoint(f));
          }}
        >
          {municipalities.map((f) => (
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
      <Map point={point} onSelect={select} ceb={ceb} />
      <section
        className="locationbar"
        aria-label={t("Selected location", "Gipiling lokasyon")}
      >
        <div className="location-heading">
          <span className="location-pin">
            <MapPin size={23} aria-hidden="true" />
          </span>
          <div>
            <h2>{municipality?.properties.name ?? "Cebu"}</h2>
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
