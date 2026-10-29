export type Locale = "en" | "fr" | "nl";
export type UnitSystem = "metric" | "imperial";
export type DataMode = "live" | "cache" | "sample";

export interface Place {
  id?: number | string;
  name: string;
  country: string;
  countryCode: string;
  admin1?: string;
  latitude: number;
  longitude: number;
  timezone?: string;
  elevation?: number;
  population?: number;
}

export interface GeoResult extends Place {
  countryCode: string;
}

export interface SourceInfo {
  id: string;
  name: string;
  shortName: string;
  center: string;
  description: string;
  color: string;
  resolution: string;
  region: "global" | "europe" | "north-america" | "asia";
}

export interface SourceCurrent {
  temp: number | null;
  apparent: number | null;
  code: number | null;
  isDay: boolean;
  precipitation: number | null;
  windSpeed: number | null;
  windGust: number | null;
  windDirection: number | null;
  humidity: number | null;
  pressure: number | null;
  visibility: number | null;
  uvIndex: number | null;
  cloudCover: number | null;
}

export interface SourceSeries extends SourceInfo {
  available: boolean;
  current: SourceCurrent;
  priorWeight: number;
  influence: number;
  deviation: number | null;
  meanAbsDeviation: number | null;
  hourlyTemp: (number | null)[];
  hourlyPrecip: (number | null)[];
  hourlyPrecipProbability: (number | null)[];
  hourlyWind: (number | null)[];
  hourlyCode: (number | null)[];
  dailyHigh: (number | null)[];
  dailyLow: (number | null)[];
  dailyPrecip: (number | null)[];
}

export interface CurrentWeather {
  time: string;
  temp: number;
  apparent: number;
  code: number;
  isDay: boolean;
  precipitation: number;
  precipitationProbability: number;
  windSpeed: number;
  windGust: number;
  windDirection: number;
  humidity: number;
  dewPoint: number;
  pressure: number;
  visibility: number;
  uvIndex: number;
  cloudCover: number;
  high: number;
  low: number;
  confidence: number;
  agreement: number;
  spread: number;
  sourceCount: number;
}

export interface HourlyPoint {
  time: string;
  temp: number;
  apparent: number;
  code: number;
  isDay: boolean;
  precipitation: number;
  precipitationProbability: number;
  rain: number;
  showers: number;
  snow: number;
  windSpeed: number;
  windGust: number;
  windDirection: number;
  humidity: number;
  dewPoint: number;
  pressure: number;
  visibility: number;
  uvIndex: number;
  cloudCover: number;
  confidence: number;
  spread: number;
}

export interface DailyPoint {
  date: string;
  code: number;
  max: number;
  min: number;
  apparentMax: number;
  apparentMin: number;
  precipitationSum: number;
  precipitationProbability: number;
  precipitationHours: number;
  windMax: number;
  gustMax: number;
  windDirection: number;
  uvMax: number;
  sunrise: string;
  sunset: string;
  daylightSeconds: number;
  confidence: number;
  spread: number;
}

export type AqiLevel = "good" | "fair" | "moderate" | "poor" | "very-poor" | "extreme";

export interface PollenReading {
  alder: number | null;
  birch: number | null;
  grass: number | null;
  mugwort: number | null;
  olive: number | null;
  ragweed: number | null;
}

export interface AirQuality {
  aqi: number;
  usAqi: number | null;
  level: AqiLevel;
  pm2_5: number | null;
  pm10: number | null;
  no2: number | null;
  so2: number | null;
  o3: number | null;
  co: number | null;
  pollen: PollenReading;
  hourlyAqi: number[];
  updatedAt: string;
}

export interface NowcastPoint {
  time: string;
  precipitation: number;
  probability: number;
}

export interface SunInfo {
  sunrise: string;
  sunset: string;
  daylightSeconds: number;
  solarNoon: string;
  moon: {
    phase: number;
    illumination: number;
    nameKey:
      | "new"
      | "waxingCrescent"
      | "firstQuarter"
      | "waxingGibbous"
      | "full"
      | "waningGibbous"
      | "lastQuarter"
      | "waningCrescent";
  };
}

export interface WeatherMeta {
  generatedAt: string;
  expiresAt: string;
  mode: DataMode;
  timezone: string;
  timezoneAbbreviation: string;
  utcOffsetSeconds: number;
  elevation: number;
  requested: { latitude: number; longitude: number };
  resolved: { latitude: number; longitude: number };
  modelCount: number;
  attribution: string;
}

export interface OfficialWarning {
  id: number | null;
  level: number | null;
  title: string;
  text: string;
  startsAt: string;
  endsAt: string;
}

export interface OfficialSource {
  provider: "IRM / KMI";
  name: string;
  latitude: number;
  longitude: number;
  distanceKm: number;
  updatedAt: string;
  snapshotAt?: string;
  mode: "live" | "snapshot";
  current: {
    temp: number;
    code: number;
    isDay: boolean;
    windSpeed: number | null;
    windGust: number | null;
    windDirection: number | null;
    precipitation: number | null;
    precipitationProbability: number | null;
    pressure: number | null;
  };
  daily: {
    max: number | null;
    min: number | null;
    code: number | null;
    precipitationProbability: number | null;
  } | null;
  warnings: OfficialWarning[];
}

export interface WeatherPayload {
  location: Place;
  meta: WeatherMeta;
  current: CurrentWeather;
  hourly: HourlyPoint[];
  daily: DailyPoint[];
  sources: SourceSeries[];
  airQuality: AirQuality | null;
  nowcast: NowcastPoint[];
  sun: SunInfo;
  official?: OfficialSource | null;
}

export interface GeocodeResponse {
  results: GeoResult[];
}

export interface PrecipMapFrame {
  /** Local ISO hour, for example 2026-10-29T14:00. */
  time: string;
  /** Row-major precipitation rate in mm/h, north to south, west to east. */
  values: number[];
  /** Highest value in this frame, in mm/h. */
  max: number;
}

export interface PrecipMap {
  generatedAt: string;
  timezone: string;
  utcOffsetSeconds: number;
  center: { latitude: number; longitude: number };
  bounds: { north: number; south: number; east: number; west: number };
  rows: number;
  cols: number;
  /** Row latitudes, north to south. */
  lats: number[];
  /** Column longitudes, west to east. */
  lons: number[];
  frames: PrecipMapFrame[];
  attribution: string;
}
