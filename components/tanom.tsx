"use client";
import { useEffect, useRef, useState } from "react";
import { LocationFinder } from "./tanom/location-finder";
import { Conditions } from "./tanom/conditions";
import { CalendarDays, ChevronRight, Info, RefreshCw } from "lucide-react";
import {
  climateSchema,
  environmentSchema,
  type Point,
} from "@/lib/tanom/contracts";
import { defaultPoint, findMunicipality } from "@/lib/tanom/geography";
import { cropRecommendations } from "@/lib/tanom/crops";
import { useResource } from "./tanom-hooks";
import { SeasonalGraphs } from "./tanom/seasonal-graphs";
import {
  analysisRequest,
  dashboardContext,
  environmentContext,
  seasonalContext,
} from "@/lib/tanom/analysis-contract";
import { seasonalRows } from "@/lib/tanom/view-data";
import "./tanom.css";
import { ConditionCards } from "./tanom/condition-cards";
import { Analysis } from "./tanom/analysis";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { CropCard } from "./tanom/crop-card";
type DashboardSection = "home" | "conditions" | "growing" | "planning" | "ml";
const sections: Record<string, DashboardSection> = {
  "/": "home",
  "/conditions": "conditions",
  "/environment": "growing",
  "/planning": "planning",
  "/ml": "ml",
};
export function Tanom() {
  const page = sections[usePathname()] ?? "home";
  const [ceb, setCeb] = useState(false);
  const [point, setPoint] = useState<Point>(defaultPoint);
  const [gpsState, setGpsState] = useState<
    "idle" | "loading" | "denied" | "outside" | "timeout" | "unavailable"
  >("idle");
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const [planning, setPlanning] = useState(
    page === "planning" || page === "growing",
  );
  const [tab, setTab] = useState<"6" | "annual">("6");
  const [outlookEnabled, setOutlookEnabled] = useState(page === "planning");
  const gpsRequest = useRef(0);
  const t = (en: string, ce: string) => (ceb ? ce : en);
  useEffect(() => {
    document.documentElement.lang = ceb ? "ceb" : "en";
  }, [ceb]);
  if (!planning && (page === "planning" || page === "growing"))
    setPlanning(true);
  if (!outlookEnabled && page === "planning") setOutlookEnabled(true);
  useEffect(
    () => () => {
      gpsRequest.current++;
    },
    [],
  );
  const params = new URLSearchParams({
    lat: String(point.lat),
    lon: String(point.lon),
  }).toString();
  const environment = useResource(
    "/api/environment?" + params,
    environmentSchema,
    600000,
  );
  const climate = useResource(
    planning ? "/api/climate-profile?" + params : null,
    climateSchema,
  );
  const outlook = useResource(
    outlookEnabled ? "/api/outlook?" + params : null,
    climateSchema,
  );
  const data = environment.data;
  const matches = cropRecommendations(climate.data, data?.elevation ?? null);
  const dateTime = (s: string) =>
    new Date(s).toLocaleString(ceb ? "ceb-PH" : "en-PH", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      timeZone: "Asia/Manila",
    });
  function select(p: Point) {
    if (!findMunicipality(p)) return;
    gpsRequest.current++;
    setPoint(p);
    setAccuracy(null);
    setGpsState("idle");
  }
  function gps() {
    if (!navigator.geolocation) {
      setGpsState("unavailable");
      return;
    }
    const id = ++gpsRequest.current;
    setGpsState("loading");
    navigator.geolocation.getCurrentPosition(
      (result) => {
        if (id !== gpsRequest.current) return;
        const p = { lat: result.coords.latitude, lon: result.coords.longitude };
        if (!findMunicipality(p)) {
          setGpsState("outside");
          return;
        }
        setPoint(p);
        setAccuracy(result.coords.accuracy);
        setGpsState("idle");
      },
      (error) => {
        if (id === gpsRequest.current)
          setGpsState(
            error.code === 1
              ? "denied"
              : error.code === 3
                ? "timeout"
                : "unavailable",
          );
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 },
    );
  }
  const season = tab === "annual" ? climate : outlook;
  const months = seasonalRows(season.data, tab);
  const gpsMessages = {
    idle: "",
    loading: t("Finding your location…", "Gipangita ang imong lokasyon…"),
    denied: t(
      "Location permission denied. Choose a place on the map or list.",
      "Wala gitugotan ang GPS. Pagpili sa mapa o listahan.",
    ),
    outside: t(
      "This location is outside Philippine land boundaries. Choose your farm on the map.",
      "Ang lokasyon gawas sa Pilipinas. Pilia ang uma sa mapa.",
    ),
    timeout: t(
      "GPS timed out. You can still select a location manually.",
      "Nahurot ang oras sa GPS. Makapili gihapon ka sa mapa.",
    ),
    unavailable: t(
      "GPS is unavailable. Use the map or municipality list.",
      "Dili magamit ang GPS. Gamita ang mapa o listahan.",
    ),
  };
  return (
    <div className="tanom">
      <a className="skip" href="#farm">
        {t("Skip to content", "Adto sa sulod")}
      </a>
      <header className="tanom-header">
        <a href="#farm" className="tanom-brand" aria-label="TANOM home">
          <svg
            width="48"
            height="48"
            viewBox="0 0 64 64"
            fill="none"
            aria-hidden="true"
          >
            <path
              d="M18 18a14 14 0 0 1 28 0"
              stroke="#B44F13"
              strokeWidth="5"
              strokeLinecap="round"
            />
            <path
              d="M6 25h52M12 34h40M19 43h26"
              stroke="#936B17"
              strokeWidth="4"
              strokeLinecap="round"
            />
            <path
              d="M32 25v19c0 8-9 9-9 15"
              stroke="#176080"
              strokeWidth="5"
              strokeLinecap="round"
            />
          </svg>
          <span>TANOM</span>
        </a>
        <div className="header-right">
          <button
            className="language"
            role="switch"
            aria-label="Cebuano"
            aria-checked={ceb}
            onClick={() => setCeb(!ceb)}
          >
            <span lang="en">EN</span>
            <span className="switch-track">
              <span className="switch-thumb" />
            </span>
            <span lang="ceb">CEB</span>
          </button>
        </div>
      </header>
      <nav
        className="page-nav"
        aria-label={t("Main navigation", "Pangunang nabigasyon")}
      >
        <div>
          {[
            ["/", "home", t("Dashboard", "Dashboard")],
            ["/conditions", "conditions", t("Conditions", "Kondisyon")],
            ["/environment", "growing", t("Environment", "Palibot")],
            [
              "/planning",
              "planning",
              t("Seasonal Planning", "Plano sa Panahon"),
            ],
            ["/ml", "ml", t("ML · Coming soon", "ML · Umaabot")],
          ].map(([href, id, label]) => (
            <Link
              scroll={false}
              key={href}
              href={href}
              aria-current={page === id ? "page" : undefined}
            >
              {label}
            </Link>
          ))}
        </div>
      </nav>
      <main id="farm">
        <section className="intro page-intro">
          <div>
            <h1 aria-live="polite" aria-atomic="true">
              {page === "home"
                ? t("Dashboard", "Dashboard")
                : page === "conditions"
                  ? t("Your weekly conditions", "Kondisyon sa semana")
                  : page === "growing"
                    ? t("Environment", "Palibot")
                    : page === "planning"
                      ? t("Plan for the season", "Plano alang sa panahon")
                      : t(
                          "ML weather predictions",
                          "ML nga forecast sa panahon",
                        )}
            </h1>
          </div>
        </section>
        {environment.loading && (
          <p className="status-note" role="status">
            {t(
              "Loading conditions for this location…",
              "Gikarga ang kondisyon sa lugar…",
            )}
          </p>
        )}
        {environment.error && (
          <div className="status-note error-note" role="alert">
            <Info size={20} aria-hidden="true" />
            <p>
              {data
                ? t(
                    "Refresh failed. These conditions may be stale.",
                    "Napakyas ang update. Basin daan na kini nga datos.",
                  )
                : t(
                    "Weather is unavailable. Map and planning remain accessible.",
                    "Walay datos sa panahon. Magamit gihapon ang mapa ug plano.",
                  )}
            </p>
            <button onClick={environment.retry}>
              <RefreshCw size={16} aria-hidden="true" />
              {t("Retry", "Sulayi pag-usab")}
            </button>
          </div>
        )}
        <div className="dashboard-layout">
          <div className="dashboard-panels">
            <div
              className="dashboard-panel"
              hidden={page !== "home"}
              data-section="home"
            >
              <ConditionCards data={data} ceb={ceb} />
              <Analysis
                key={JSON.stringify(
                  analysisRequest(point, ceb, dashboardContext(data)),
                )}
                request={analysisRequest(point, ceb, dashboardContext(data))}
                ceb={ceb}
              />
            </div>
            <div
              className="dashboard-panel"
              hidden={page !== "conditions"}
              data-section="conditions"
            >
              <Conditions data={data} ceb={ceb} point={point} />
            </div>
            <div
              className="dashboard-panel environment-panel"
              hidden={page !== "growing"}
              data-section="growing"
            >
              <section
                className="tanom-panel cropsection"
                aria-labelledby="crop-title"
              >
                <div className="crop-title-card">
                  <h2 id="crop-title">
                    {t("Crops to Explore", "Mga tanom nga susihon")}
                  </h2>
                  <p>
                    {t(
                      "Explore crops based on this location’s climate and elevation, and compare their growing needs.",
                      "Susihon ang mga tanom base sa klima ug kahabogon niining dapita, ug itandi ang ilang mga kinahanglanon sa pagtubo.",
                    )}
                  </p>
                </div>
                {climate.loading && planning && (
                  <p className="status-note" role="status">
                    {t(
                      "Loading the 1991–2020 climate profile for crop matching…",
                      "Gikarga ang klima sa 1991–2020 alang sa pagpares…",
                    )}
                  </p>
                )}
                {climate.error && (
                  <div className="status-note">
                    <p>
                      {t(
                        "Historical climate is unavailable; crop matches cannot be calculated.",
                        "Walay datos sa klima; dili makakwenta sa pagpares.",
                      )}
                    </p>
                    <button onClick={climate.retry}>
                      {t("Retry climate data", "Sulayi pag-usab ang klima")}
                    </button>
                  </div>
                )}
                {matches && matches.length > 0 ? (
                  <div className="crop-grid">
                    {matches.map((crop) => (
                      <CropCard key={crop.id} crop={crop} ceb={ceb} />
                    ))}
                  </div>
                ) : (
                  !climate.loading && (
                    <p className="status-note">
                      {matches
                        ? t(
                            "No catalog crops meet all available climate/elevation limits. No unsuitable crops have been added.",
                            "Walay tanom sa katalogo nga nahiuyon sa datos.",
                          )
                        : t(
                            "Complete climate and elevation data are needed for crop matches.",
                            "Gikinahanglan ang kompleto nga klima ug kahabogon.",
                          )}
                    </p>
                  )
                )}
                <p className="limitations">
                  <Info size={18} aria-hidden="true" />
                  {t(
                    "Soil type, pH, fertility, slope, drainage, irrigation and cultivar suitability are unknown. Current weather is short-term context, not proof a crop will grow well.",
                    "Wala mahibaloi ang matang sa yuta, pH, katambok, bakilid, drainage, irigasyon ug cultivar. Ang panahon karon dili pamatuod sa maayong pagtubo.",
                  )}
                </p>
              </section>
              <Analysis
                key={JSON.stringify(
                  analysisRequest(
                    point,
                    ceb,
                    environmentContext(data, climate.data),
                  ),
                )}
                request={analysisRequest(
                  point,
                  ceb,
                  environmentContext(data, climate.data),
                )}
                ceb={ceb}
              />
            </div>
            <div
              className="dashboard-panel"
              hidden={page !== "planning"}
              data-section="planning"
            >
              <section className="tanom-panel season">
                <div className="section-title">
                  <div>
                    <p className="eyeline">
                      {t("LOOK A LITTLE FURTHER", "TAN-AW SA UMAABOT")}
                    </p>
                    <h2>{t("Seasonal planning", "Plano sa panahon")}</h2>
                  </div>
                  <CalendarDays size={28} aria-hidden="true" />
                </div>
                <div
                  className="season-tabs"
                  role="group"
                  aria-label={t("Planning period", "Gidugayon sa plano")}
                >
                  {(["6", "annual"] as const).map((value) => (
                    <button
                      key={value}
                      aria-pressed={tab === value}
                      onClick={() => {
                        setPlanning(true);
                        setTab(value);
                      }}
                    >
                      {value === "annual"
                        ? t("Annual climate profile", "Tinuig nga klima")
                        : value + " " + t("months", "ka bulan")}
                      <ChevronRight size={16} aria-hidden="true" />
                    </button>
                  ))}
                </div>
                {season.loading && planning && (
                  <p className="status-note" role="status">
                    {t("Loading planning data…", "Gikarga ang datos sa plano…")}
                  </p>
                )}
                {season.error && (
                  <div className="status-note error-note" role="alert">
                    <p>
                      {t(
                        "Planning data is unavailable. Current weather is unaffected.",
                        "Walay datos sa plano. Dili apektado ang panahon karon.",
                      )}
                    </p>
                    <button onClick={season.retry}>
                      {t("Retry", "Sulayi pag-usab")}
                    </button>
                  </div>
                )}
                {months.length > 0 && (
                  <>
                    <SeasonalGraphs rows={months} ceb={ceb} />
                    <p className="microcopy">
                      {season.data?.source} · {t("Retrieved", "Gikuha")}:{" "}
                      {season.data && dateTime(season.data.fetchedAt)} PHT
                    </p>
                  </>
                )}
                <p className="limitations">
                  <Info size={18} aria-hidden="true" />
                  {tab === "annual"
                    ? t(
                        "1991–2020 ERA5 historical climate profile, not a forecast or local weather-station record.",
                        "Ang reanalysis modelo sa kasaysayan, dili lokal nga weather station.",
                      )
                    : t(
                        "ECMWF SEAS5 regional ensemble mean, approximately 36 km resolution, not bias-corrected. Long-range forecasts are uncertain. No farm-level confidence or above/below-normal claims are inferred. Partial months are labeled, not extrapolated.",
                        "Dili sigurado ang dugay nga forecast. Ang kulang nga bulan gimarkahan ug wala gipuno.",
                      )}
                </p>
              </section>
              <Analysis
                key={JSON.stringify(
                  analysisRequest(
                    point,
                    ceb,
                    seasonalContext(season.data, tab),
                  ),
                )}
                request={analysisRequest(
                  point,
                  ceb,
                  seasonalContext(season.data, tab),
                )}
                ceb={ceb}
              />
            </div>
            <div
              className="dashboard-panel"
              hidden={page !== "ml"}
              data-section="ml"
            >
              <section className="tanom-panel">
                <h2>ML Weather Predictions</h2>
                <p>Coming soon. No ML predictions are available yet.</p>
              </section>
            </div>
          </div>
          <aside
            className="dashboard-location"
            aria-label={t("Farm location", "Lokasyon sa uma")}
          >
            <LocationFinder
              point={point}
              select={select}
              gps={gps}
              gpsState={gpsState}
              gpsMessage={gpsMessages[gpsState]}
              accuracy={accuracy}
              ceb={ceb}
            />
          </aside>
        </div>
        <footer className="tanom-footer">
          <svg
            width="48"
            height="48"
            viewBox="0 0 64 64"
            fill="none"
            aria-hidden="true"
          >
            <path
              d="M18 18a14 14 0 0 1 28 0"
              stroke="#B44F13"
              strokeWidth="5"
              strokeLinecap="round"
            />
            <path
              d="M6 25h52M12 34h40M19 43h26"
              stroke="#936B17"
              strokeWidth="4"
              strokeLinecap="round"
            />
            <path
              d="M32 25v19c0 8-9 9-9 15"
              stroke="#176080"
              strokeWidth="5"
              strokeLinecap="round"
            />
          </svg>
          <span>TANOM</span>
        </footer>
      </main>
    </div>
  );
}
