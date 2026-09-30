export interface Location {
  id: string;
  name: string;
  region: string;
  latitude: number;
  longitude: number;
}
export type StressLevel = "Low" | "Moderate" | "Elevated" | "High" | "Extreme";
export interface AtmosphericFeatures {
  humidity: number | null;
  surfacePressure: number | null;
  cloudCover: number | null;
  windSpeed: number | null;
  cape: number | null;
  soilMoisture: number | null;
}
export interface ContributingFactor {
  name: string;
  value: number | null;
  unit: string;
  points: number;
  maxPoints: number;
  description: string;
}
export interface RainfallRisk {
  location: Location;
  fetchedAt: string;
  current: {
    time: number;
    rainfall: number;
    rain: number | null;
    temperature: number | null;
  };
  next3hRainfall: number;
  next6hRainfall: number;
  next24hRainfall: number;
  previous24hRainfall: number | null;
  precipitationProbability: number | null;
  peakRainfallPeriod: { start: number; end: number; rainfall: number } | null;
  atmosphericFeatures: AtmosphericFeatures;
  stressScore: number;
  stressLevel: StressLevel;
  contributingFactors: ContributingFactor[];
  missingFeatures: string[];
  hourly: { time: number; rainfall: number; probability: number | null; correctedRainfall?: number | null }[];
  mlForecast: { rawNext6h: number; correctedNext6h: number | null; modelName: string | null; modelVersion: string | null; improvementKnown: boolean };
}
