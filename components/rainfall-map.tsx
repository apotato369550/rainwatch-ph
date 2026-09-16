"use client";
import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import { locations } from "@/lib/locations";
import type { RainfallRisk } from "@/lib/types";
import { severityColors } from "@/lib/format";
import { design } from "@/lib/design";
export default function RainfallMap({
  selected,
  onSelect,
  data,
}: {
  selected: string;
  onSelect: (id: string) => void;
  data: RainfallRisk | null;
}) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const markers = useRef<Map<string, L.Marker>>(new Map());
  const selectCallback = useRef(onSelect);
  const [error, setError] = useState(false);
  useEffect(() => {
    selectCallback.current = onSelect;
  }, [onSelect]);
  useEffect(() => {
    if (!container.current) return;
    const instance = L.map(container.current, {
      center: [12.1, 122.5],
      zoom: 5,
      minZoom: 3,
      zoomSnap: 0.25,
      zoomAnimation: false,
      fadeAnimation: false,
      markerZoomAnimation: false,
      maxZoom: 13,
      scrollWheelZoom: false,
      attributionControl: true,
    });
    map.current = instance;
    // Geographic grid moves with the map, rather than a decorative screen grid.
    for (let latitude = 4; latitude <= 22; latitude += 2) {
      L.polyline(
        [
          [latitude, 115],
          [latitude, 130],
        ],
        { color: design.border, weight: 1, opacity: 0.5, interactive: false },
      ).addTo(instance);
      L.marker([latitude, 117.1], {
        interactive: false,
        keyboard: false,
        icon: L.divIcon({
          className: "coordinate-label",
          html: `${latitude}°N`,
        }),
      }).addTo(instance);
    }
    for (let longitude = 116; longitude <= 130; longitude += 2) {
      L.polyline(
        [
          [3, longitude],
          [23, longitude],
        ],
        { color: design.border, weight: 1, opacity: 0.5, interactive: false },
      ).addTo(instance);
    }
    instance.fitBounds(
      [
        [4.5, 116.8],
        [21.2, 127],
      ],
      { padding: [12, 12] },
    );
    instance.attributionControl.addAttribution(
      '<a href="https://www.naturalearthdata.com/">Natural Earth</a>',
    );
    const controller = new AbortController();
    fetch("/philippines.geojson", { signal: controller.signal })
      .then((r) => {
        if (!r.ok) throw Error("Map unavailable");
        return r.json();
      })
      .then((geo) => {
        L.geoJSON(geo, {
          style: {
            color: design.controlBorder,
            weight: 1,
            fillColor: design.raised,
            fillOpacity: 1,
          },
        }).addTo(instance);
      })
      .catch((e) => {
        if (e.name !== "AbortError") setError(true);
      });
    const markerSet = markers.current;
    for (const city of locations) {
      const marker = L.marker([city.latitude, city.longitude], {
        title: city.name,
        alt: `Select ${city.name}`,
        keyboard: true,
        icon: L.divIcon({
          className: "city-marker",
          html: '<span style="--marker-color:#91a1ad"></span>',
          iconSize: [44, 44],
          iconAnchor: [22, 22],
        }),
      }).addTo(instance);
      marker.bindTooltip(city.name, { direction: "top", offset: [0, -8] });
      marker.on("click", () => selectCallback.current(city.id));
      markerSet.set(city.id, marker);
    }
    const observer = new ResizeObserver(() => instance.invalidateSize());
    observer.observe(container.current);
    return () => {
      controller.abort();
      observer.disconnect();
      instance.remove();
      map.current = null;
      markerSet.clear();
    };
  }, []);
  useEffect(() => {
    markers.current.forEach((marker, id) => {
      const active = id === selected;
      const color =
        active && data?.location.id === id
          ? severityColors[data.stressLevel]
          : design.secondary;
      marker.setIcon(
        L.divIcon({
          className: `city-marker ${active ? "selected" : ""}`,
          html: `<span style="--marker-color:${color}"></span>`,
          iconSize: [44, 44],
          iconAnchor: [22, 22],
        }),
      );
      marker.setZIndexOffset(active ? 1000 : 0);
      marker.unbindTooltip();
      marker.bindTooltip(locations.find((city) => city.id === id)!.name, {
        permanent: active,
        direction: "top",
        offset: [0, -8],
      });
    });
  }, [selected, data]);
  return (
    <section className="panel map-panel">
      <div className="section-heading">
        <div>
          <h2>Across the Philippines</h2>
          <p>Select a city to explore its forecast</p>
        </div>
        <span className="tag">10 cities</span>
      </div>
      <div className="map-wrap">
        <div
          ref={container}
          className="map-canvas"
          aria-label="Interactive map of Philippine cities"
        />
        <button
          className="map-reset"
          onClick={() =>
            map.current?.fitBounds(
              [
                [4.5, 116.8],
                [21.2, 127],
              ],
              { padding: [12, 12] },
            )
          }
        >
          Reset view
        </button>
      </div>
      {error && (
        <p role="alert" className="warning">
          Map outline unavailable. City markers and the selector still work.
        </p>
      )}
      <div className="map-footer">
        <span>
          <i className="dot" />{" "}
          {locations.find((city) => city.id === selected)?.name}
          {data ? ` · ${data.stressLevel}` : ""}
        </span>
        <span>Gray: not loaded · zoom for nearby cities</span>
      </div>
    </section>
  );
}
