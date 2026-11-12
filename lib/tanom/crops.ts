import type { Climate } from "./contracts";
type Range = [number, number];
type Crop = {
  id: number;
  name: string;
  ceb: string;
  icon: "leaf" | "fruit" | "grain" | "bean";
  temp: Range;
  absoluteTemp: Range;
  rain: Range;
  absoluteRain: Range;
  maxElevation: number;
};
export const crops: Crop[] = [
  {
    id: 554,
    name: "Cabbage",
    ceb: "Repolyo",
    icon: "leaf",
    temp: [15, 24],
    absoluteTemp: [7, 32],
    rain: [500, 1000],
    absoluteRain: [300, 2500],
    maxElevation: 2000,
  },
  {
    id: 1379,
    name: "Tomato",
    ceb: "Kamatis",
    icon: "fruit",
    temp: [20, 27],
    absoluteTemp: [7, 35],
    rain: [600, 1300],
    absoluteRain: [400, 1800],
    maxElevation: 2400,
  },
  {
    id: 2175,
    name: "Maize",
    ceb: "Mais",
    icon: "grain",
    temp: [18, 33],
    absoluteTemp: [10, 47],
    rain: [600, 1200],
    absoluteRain: [400, 1800],
    maxElevation: 4000,
  },
  // EcoCrop 1965's altitude value (50m) conflicts with its descriptive page; retain conservatively rather than silently correcting it.
  {
    id: 1965,
    name: "Eggplant",
    ceb: "Talong",
    icon: "fruit",
    temp: [20, 35],
    absoluteTemp: [9, 40],
    rain: [1200, 1600],
    absoluteRain: [800, 4000],
    maxElevation: 50,
  },
  {
    id: 289,
    name: "Okra",
    ceb: "Okra",
    icon: "leaf",
    temp: [20, 30],
    absoluteTemp: [12, 35],
    rain: [600, 1200],
    absoluteRain: [300, 2500],
    maxElevation: 1000,
  },
  {
    id: 2150,
    name: "Mung bean",
    ceb: "Monggos",
    icon: "bean",
    temp: [21, 36],
    absoluteTemp: [8, 40],
    rain: [650, 900],
    absoluteRain: [500, 1250],
    maxElevation: 2000,
  },
  // FAO EcoCrop datasheet 1574, verified 2026-11-12: https://ecocrop.apps.fao.org/ecocrop/srv/en/dataSheet?id=1574
  {
    id: 1574,
    name: "Rice",
    ceb: "Humay",
    icon: "grain",
    temp: [20, 30],
    absoluteTemp: [10, 36],
    rain: [1500, 2000],
    absoluteRain: [1000, 4000],
    maxElevation: 2500,
  },
  // FAO EcoCrop datasheet 1265, verified 2026-11-12: https://ecocrop.apps.fao.org/ecocrop/srv/en/dataSheet?id=1265
  {
    id: 1265,
    name: "Sweet potato",
    ceb: "Kamote",
    icon: "leaf",
    temp: [18, 28],
    absoluteTemp: [10, 38],
    rain: [750, 2000],
    absoluteRain: [350, 5000],
    maxElevation: 2800,
  },
  // FAO EcoCrop datasheet 1420, verified 2026-11-12: https://ecocrop.apps.fao.org/ecocrop/srv/en/dataSheet?id=1420
  {
    id: 1420,
    name: "Cassava",
    ceb: "Balanghoy",
    icon: "leaf",
    temp: [20, 29],
    absoluteTemp: [10, 35],
    rain: [1000, 1500],
    absoluteRain: [500, 5000],
    maxElevation: 2000,
  },
  // FAO EcoCrop datasheet 820, verified 2026-11-12: https://ecocrop.apps.fao.org/ecocrop/srv/en/dataSheet?id=820
  {
    id: 820,
    name: "Squash",
    ceb: "Kalabasa",
    icon: "fruit",
    temp: [20, 30],
    absoluteTemp: [10, 40],
    rain: [600, 1600],
    absoluteRain: [300, 2800],
    maxElevation: 2400,
  },
];
const within = (v: number, r: Range) => v >= r[0] && v <= r[1];
export function cropMatches(profile: Climate | null, elevation: number | null) {
  if (
    !profile ||
    profile.months.length !== 12 ||
    elevation === null ||
    !Number.isFinite(elevation) ||
    profile.months.some((m) => m.heat === null || m.rain === null || m.partial)
  )
    return null;
  const temperature = profile.months.reduce((s, m) => s + m.heat!, 0) / 12;
  const rainfall = profile.months.reduce((s, m) => s + m.rain!, 0);
  return crops
    .filter(
      (c) =>
        within(temperature, c.absoluteTemp) &&
        within(rainfall, c.absoluteRain) &&
        elevation <= c.maxElevation,
    )
    .map((c) => ({
      ...c,
      temperature,
      rainfall,
      optimalTemp: within(temperature, c.temp),
      optimalRain: within(rainfall, c.rain),
      score:
        Number(within(temperature, c.temp)) + Number(within(rainfall, c.rain)),
    }))
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name))
    .slice(0, 7);
}

export function cropRecommendations(
  profile: Climate | null,
  elevation: number | null,
) {
  const suitable = cropMatches(profile, elevation);
  if (!suitable || !profile || elevation === null) return null;
  const temperature = profile.months.reduce((s, m) => s + m.heat!, 0) / 12;
  const rainfall = profile.months.reduce((s, m) => s + m.rain!, 0);
  const candidates = crops.map((c) => ({
    ...c,
    unmet: [
      ...(!within(temperature, c.absoluteTemp) ? ["temperature"] : []),
      ...(!within(rainfall, c.absoluteRain) ? ["rainfall"] : []),
      ...(elevation > c.maxElevation ? ["elevation"] : []),
    ],
    score:
      Number(within(temperature, c.temp)) + Number(within(rainfall, c.rain)),
  }));
  const matches = candidates
    .filter((c) => !c.unmet.length)
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name))
    .slice(0, 7);
  if (matches.length < 2)
    matches.push(
      ...candidates
        .filter((c) => c.unmet.length)
        .sort(
          (a, b) =>
            a.unmet.length - b.unmet.length ||
            b.score - a.score ||
            a.name.localeCompare(b.name),
        )
        .slice(0, 2 - matches.length),
    );
  return matches;
}
