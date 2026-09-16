# RainWatch PH

A deployable Philippine rainfall dashboard built with Next.js App Router, TypeScript, Tailwind CSS, Recharts, and Leaflet. No database, authentication, API keys, or environment variables are required.

## Run locally

Use Node.js 20.9+ (Node 24 recommended).

```bash
npm install
npm run dev
```

Open http://localhost:3000. The server needs internet access to Open-Meteo. Forecasts are real model data; an outage shows an explicit error, never sample weather.

```bash
npm run typecheck
npm run lint
npm test
npm run build
npm start
```

Browser integration checks use live weather and therefore require Open-Meteo availability:

```bash
npx playwright install chromium
npm run build
npm run test:e2e
```

## Deploy to Vercel

1. Push this project to a GitHub repository.
2. Import the repository in Vercel and select the Next.js framework preset.
3. Use the repository root, `npm install`, and `npm run build`; keep the default output settings.
4. Select Node.js 24.x. Leave environment variables empty and deploy.

The weather route runs within Next.js on Vercel. Do not use static export: `/api/weather` requires the server runtime. Building does not require weather-provider availability. No separate infrastructure is needed.

## Observatory interface

The dashboard uses self-hosted IBM Plex Sans (400/500/600), supplied by `@fontsource/ibm-plex-sans` and bundled with `next/font/local`. No font service is contacted at runtime or build time. The font package includes its open font license.

Shared palette tokens live in `lib/design.ts` and feed the page, Recharts, and Leaflet. Body text is 16px, supporting text 14px, and peripheral labels at least 12px. Primary and secondary text colors meet a 7:1 contrast target on the three main surfaces. Essential graphical indicators and control borders meet 3:1. Severity remains labeled in words as well as color.

The city heading and forecast strip lead into the rainfall chart, stress explanation, and geographic overview. Below 1100px the reading order becomes chart → stress and factors → map → current and recent conditions. The forecast strip becomes two columns at 900px and below. The map uses a geographic coordinate grid and a permanent selected-city label.

Browser checks run against a separate production server on port 3100. Deterministic dry, heavy-rain, missing-input, and outage fixtures support repeatable screenshots and axe accessibility checks; fixtures are only used by tests. Responsive checks cover 320, 390, 720, 768, and 1440 CSS pixels. The 720px check covers the layout viewport equivalent of a 1440px display at 200% zoom. Live Open-Meteo checks remain separate from the fixture scenarios. Screenshots are saved in `test-results/`.

## Features and data flow

- Ten locally configured cities: Cebu City, Mandaue, Lapu-Lapu, Manila, Quezon City, Marikina, Davao City, Cagayan de Oro, Iloilo City, and Baguio.
- Browser → `/api/weather?location=cebu` → cached Open-Meteo request → validated series → rainfall summary and stress score.
- Only supported location IDs are accepted (400 otherwise). Provider errors, timeouts, invalid schemas, and incomplete rainfall return 502 with a friendly message.
- Successful provider responses are cached server-side for 600 seconds, keyed by coordinates and current UTC hour. API responses are not browser-cached. Refresh uses the server cache; it does not force a new provider request. Active tabs refresh every ten minutes.
- Responses include their original fetch timestamp. If a refresh fails, any previously loaded data for the same city is visibly identified as potentially stale. Switching cities never displays another city's values.
- Leaflet loads only in the browser. Its country outline is bundled locally, so no tile provider, geocoding service, or map key is used. Zoom in to distinguish nearby cities; all cities are also available in the accessible selector. Only the selected city receives a stress color; gray markers have no loaded score.

## Weather semantics

Source: [Open-Meteo Forecast API documentation](https://open-meteo.com/en/docs).

Requested hourly variables are precipitation, rain, precipitation probability, relative humidity, surface pressure, cloud cover, wind speed, CAPE, soil moisture at 0–1 cm, and temperature. Zod validates ranges, series lengths, and continuous timestamps. Two past days and three forecast days cover the comparison and forecast windows.

Open-Meteo precipitation is the **preceding hour's sum**. At 10:35 PHT, “current” is the modeled 09:00–10:00 total, and the next three hours sum the 10:00–13:00 intervals (end timestamps 11:00, 12:00, 13:00). The six- and 24-hour windows follow the same convention. These are hour-aligned windows, not fractional windows from the exact current minute. All displayed times explicitly use Asia/Manila, regardless of browser timezone.

Rainfall cards use total precipitation, which includes showers; Open-Meteo's `rain` field covers large-scale rain and is displayed separately. The probability card is the maximum of 24 hourly probabilities, not the probability of rain at any time over the whole day. Peak period is the highest one-hour total, with the earliest period selected for ties; a dry forecast has no peak.

The previous 24-hour comparison uses modeled weather from the same forecast endpoint, not rain-gauge observations, a climatology, or a historical percentile. It provides recent context but does not enter the stress formula.

## Experimental Rainfall Stress formula

For each row, clamp the normalized input to [0, 1], multiply by its weight, sum, and round to the nearest integer.

| Input                                | Normalization         | Maximum points |
| ------------------------------------ | --------------------- | -------------: |
| Next 6h precipitation                | mm / 50               |             35 |
| Next 24h precipitation               | mm / 100              |             30 |
| Current hourly humidity              | (% − 60) / 40         |             10 |
| Current hourly surface soil moisture | (m³/m³ − 0.10) / 0.40 |             15 |
| Current hourly CAPE                  | J/kg / 2,500          |             10 |

Levels: Low 0–29, Moderate 30–49, Elevated 50–69, High 70–84, Extreme 85–100. Factors are ranked by their weighted contributions. The UI exposes the full formula and individual point values.

These are illustrative, fixed thresholds, not calibrated Philippine warning criteria. Six-hour and 24-hour rainfall intentionally overlap and contribute 65% of the maximum score. Missing atmospheric inputs contribute zero without reweighting and produce an incomplete-score warning. Missing rainfall in any required forecast interval fails the request. Missing probability or recent-rainfall data is shown as unavailable.

**Rainfall Stress is an experimental indicator and is NOT a flood prediction.** It does not model drainage, topography, rivers, tides, or local flooding. CAPE alone does not guarantee storms. Follow PAGASA and local authorities for official warnings.

## Structure and extension points

```text
app/                 App Router page, layout, styles, and weather route
components/          Dashboard, selector, conditions, summaries, chart, stress, map
lib/locations.ts     Supported cities and coordinates
lib/types.ts         Shared RainfallRisk contract
lib/weather-schema.ts Runtime provider validation
lib/open-meteo.ts    Server-only provider fetching and caching
lib/rainfall.ts      Pure aggregation and scoring functions
public/              Bundled Philippines outline
tests/               Calculation, validation, and browser integration checks
```

Future persistence can store the shared `RainfallRisk` output without changing presentation components. A historical baseline or forecast correction can be added at the server transformation layer. Neither is implemented in this MVP.

## Attribution and usage

Weather data: [Open-Meteo](https://open-meteo.com/), [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). The free endpoint is intended for non-commercial use, with provider usage limits; review [current terms](https://open-meteo.com/en/terms) before commercial deployment or increased traffic. This portfolio MVP uses no paid API.

Country geometry: [Natural Earth](https://www.naturalearthdata.com/), public domain, 1:50m Admin 0 countries, extracted from [the Natural Earth vector dataset](https://github.com/nvkelso/natural-earth-vector/blob/master/geojson/ne_50m_admin_0_countries.geojson). The outline is a simplified overview, not a navigational or administrative boundary reference.
