"use client";
import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import {
  Activity,
  ArrowUpRight,
  CloudRain,
  Info,
  RefreshCw,
  MapPin,
} from "lucide-react";
import { locations } from "@/lib/locations";
import type { RainfallRisk } from "@/lib/types";
import { dateTime, number } from "@/lib/format";
import { LocationSelector } from "./location-selector";
import { BrandMark } from "./brand-mark";
import { LearnSection } from "./learn-section";
import { ConditionsCard } from "./conditions-card";
import { RainfallSummary } from "./rainfall-summary";
import { StressGauge } from "./stress-gauge";
import { MlForecast } from "./ml-forecast";
import { RainfallChart } from "./rainfall-chart";
const RainfallMap = dynamic(() => import("./rainfall-map"), {
  ssr: false,
  loading: () => <div className="panel map-placeholder">Loading map…</div>,
});
export function Dashboard() {
  const [selected, setSelected] = useState("cebu");
  const [data, setData] = useState<RainfallRisk | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refresh, setRefresh] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`/api/weather?location=${selected}`, {
          signal: controller.signal,
          cache: "no-store",
        });
        const result = await response.json();
        if (!response.ok)
          throw new Error(result.error ?? "Unable to load weather.");
        if (active) setData(result);
      } catch (e) {
        if (active && !controller.signal.aborted)
          setError(e instanceof Error ? e.message : "Unable to load weather.");
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void load();
    }, 600_000);
    return () => {
      active = false;
      controller.abort();
      window.clearInterval(timer);
    };
  }, [selected, refresh]);
  const city = locations.find((l) => l.id === selected)!;
  const visible = data?.location.id === selected ? data : null;
  const changeCity = (id: string) => {
    if (id !== selected) {
      setSelected(id);
      setLoading(true);
      setError(null);
    }
  };
  return (
    <>
      <header className="topbar">
        <a className="brand" href="#today" aria-label="RainWatch PH home">
          <BrandMark />
          <span>RainWatch <b>PH</b></span>
        </a>
        <nav>
          <a className="nav-active" href="#today">Today</a>
          <a href="#forecast">Forecast</a>
          <a href="#map">Map</a>
          <a href="/history">History</a>
          <a href="#learn">Learn</a>
          <a href="#methodology">How it works</a>
        </nav>
        <span className="header-note">
          <span className="dot" /> Live Philippine rainfall outlook
        </span>
      </header>
      <main>
        <section id="today" className="hero" aria-labelledby="today-title">
          <div className="page-title">
          <div>
            <div className="eyebrow title-eyebrow">Rainfall outlook · Philippine time</div>
            <h1 id="today-title">Will it rain in <em>{city.name}</em>?</h1>
            <p>See the next 24 hours at a glance, then dig into the forecast when you need it.</p>
          </div>
          <div className="controls">
            <LocationSelector value={selected} onChange={changeCity} />
            <button
              className="refresh"
              disabled={loading}
              onClick={() => setRefresh((v) => v + 1)}
              aria-label="Refresh weather"
            >
              <RefreshCw size={17} className={loading ? "refreshing" : ""} />
            </button>
          </div>
        </div>
        <div className="location-row">
          <div>
            <MapPin size={16} />
            <span className="region-name">{city.region}</span>
            <span>
              {city.latitude.toFixed(4)}° N / {city.longitude.toFixed(4)}° E
            </span>
          </div>
          <span className="update-status" role="status">
            {loading
              ? "Updating forecast…"
              : error
                ? "Connection issue"
                : visible
                  ? `Fetched ${dateTime(Date.parse(visible.fetchedAt) / 1000)} PHT · refreshes every 10 min`
                  : ""}
          </span>
        </div>
        <div className="notice">
          <Info size={17} />
          <p>
            Rainfall Stress is an experimental indicator and is NOT a flood prediction. It currently uses the raw Open-Meteo forecast.
          </p>
        </div>
        {error && (
          <div className="error" role="alert">
            <div>
              <strong>We couldn’t update the forecast.</strong>
              <p>
                {error}
                {visible
                  ? " Previously fetched data is shown below and may be stale."
                  : " No forecast values are being displayed."}
              </p>
            </div>
            <button onClick={() => setRefresh((v) => v + 1)}>Try again</button>
          </div>
        )}
        <div aria-busy={loading}>
          {visible ? (
            <>
              <RainfallSummary data={visible} />
              <MlForecast data={visible} />
              <section className="plain-language panel">
                <span className="eyebrow">What this means</span>
                <h2>
                  {visible.next24hRainfall === 0
                    ? "A dry day is currently forecast."
                    : visible.next24hRainfall < 10
                      ? "A few passing showers are possible."
                      : visible.next24hRainfall < 30
                        ? "Keep an umbrella close today."
                        : "Plan around periods of heavier rain."}
                </h2>
                <p>
                  {number(visible.next24hRainfall)} mm is expected over the next 24 hours. The forecast can change, so check official PAGASA and local advisories for warnings.
                </p>
              </section>
              <section id="forecast" className="content-section section-anchor" aria-label="Forecast details">
                <div className="section-label"><span>Forecast details</span><p>Hourly rainfall, chance of rain, and conditions behind the outlook.</p></div>
              <div className="main-grid">
                <div className="chart-region">
                  <RainfallChart data={visible} />
                </div>
                <div className="stress-region">
                  <StressGauge data={visible} />
                </div>
                <div className="map-region">
                  <div id="map" className="section-anchor"><RainfallMap selected={selected} onSelect={changeCity} data={visible} /></div>
                </div>
                <div className="lower-grid">
                  <ConditionsCard data={visible} />
                  <section className="panel context-panel">
                    <div className="section-heading">
                      <h2>Rain in context</h2>
                      <Activity size={17} />
                    </div>
                    <span className="eyebrow">Previous 24 hours</span>
                    <div className="metric-value">
                      {number(visible.previous24hRainfall)} <span>mm</span>
                    </div>
                    <p>
                      {visible.previous24hRainfall === null
                        ? "Recent comparison is unavailable."
                        : `${number(Math.abs(visible.next24hRainfall - visible.previous24hRainfall))} mm ${visible.next24hRainfall >= visible.previous24hRainfall ? "more" : "less"} expected in the next 24h.`}
                    </p>
                    <div className="context-note">
                      Recent values are modeled weather, not rain-gauge
                      observations. This comparison is separate from the stress
                      score.
                    </div>
                  </section>
                </div>
              </div>
              </section>
            </>
          ) : (
            <div className="empty-grid">
              <section className="panel loading-panel" role="status">
                <CloudRain size={46} />
                <h2>
                  {loading
                    ? `Reading the skies over ${city.name}…`
                    : "Forecast unavailable"}
                </h2>
                <p>
                  {loading
                    ? "Fetching hourly weather and calculating rainfall totals."
                    : "Retry above to reconnect to Open-Meteo."}
                </p>
              </section>
              <RainfallMap
                selected={selected}
                onSelect={changeCity}
                data={null}
              />
            </div>
          )}
        </div>
        </section>
        <LearnSection />
        <section id="methodology" className="methodology">
          <span className="eyebrow">How it works</span>
          <h2>Built for perspective, not prediction.</h2>
          <p>
            RainWatch PH summarizes Open-Meteo weather models. “Current” means the latest completed hourly period, while the forecast begins at the next hour boundary. Rainfall includes rain and showers. Rainfall Stress combines forecast rainfall, humidity, surface soil moisture, and atmospheric instability using fixed experimental thresholds. It does not model rivers, terrain, drainage, tides, or flooding. For official warnings, follow PAGASA and your local authorities.
          </p>
          <a className="text-link" href="#forecast">Explore the forecast <ArrowUpRight size={15} /></a>
        </section>
        <footer>
          <span className="footer-brand">
            <BrandMark size={24} /> RainWatch PH <span> / an independent weather project</span>
          </span>
          <a href="https://open-meteo.com/" target="_blank" rel="noreferrer">
            Weather data by Open-Meteo · CC BY 4.0 <ArrowUpRight size={13} />
          </a>
          <span>All times in PHT (UTC+8)</span>
        </footer>
      </main>
    </>
  );
}
