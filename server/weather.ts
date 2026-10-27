import type {
  AirQuality,
  AqiLevel,
  CurrentWeather,
  DailyPoint,
  HourlyPoint,
  NowcastPoint,
  Place,
  SourceCurrent,
  SourceSeries,
  SunInfo,
  WeatherMeta,
  WeatherPayload,
} from "../shared/types.ts";
import { MODELS, normaliseWeights, weightProfile, type ModelDefinition } from "./models.ts";
import {
  circularMean,
  clamp,
  hourConfidence,
  median,
  mostCommonBoolean,
  round,
  standardDeviation,
  temperatureAgreement,
  weightedMean,
  weightedModeCode,
  weightedStd,
  type WeightedValue,
} from "./consensus.ts";

export interface WeatherQuery {
  latitude: number;
  longitude: number;
  name: string;
  country: string;
  countryCode: string;
  admin1?: string;
  timezone?: string;
  elevation?: number;
}

interface CacheEntry {
  payload: WeatherPayload;
  expiresAt: number;
}

interface InternalSource {
  def: ModelDefinition;
  priorWeight: number;
  influence: number;
  available: boolean;
  hourly: Record<string, (number | null)[]>;
  daily: Record<string, (number | null)[]>;
  dailyTime: Record<string, (string | null)[]>;
  current: Record<string, number | null>;
}

type ApiObject = Record<string, any>;

const CACHE_TTL_MS = 8 * 60 * 1000;
const cache = new Map<string, CacheEntry>();
const inFlight = new Map<string, Promise<WeatherPayload>>();

const HOURLY_VARIABLES = [
  "temperature_2m",
  "apparent_temperature",
  "precipitation",
  "precipitation_probability",
  "rain",
  "showers",
  "snowfall",
  "weather_code",
  "cloud_cover",
  "relative_humidity_2m",
  "dew_point_2m",
  "wind_speed_10m",
  "wind_gusts_10m",
  "wind_direction_10m",
  "pressure_msl",
  "visibility",
  "uv_index",
  "is_day",
];

const DAILY_VARIABLES = [
  "weather_code",
  "temperature_2m_max",
  "temperature_2m_min",
  "apparent_temperature_max",
  "apparent_temperature_min",
  "sunrise",
  "sunset",
  "daylight_duration",
  "uv_index_max",
  "precipitation_sum",
  "precipitation_probability_max",
  "precipitation_hours",
  "wind_speed_10m_max",
  "wind_gusts_10m_max",
  "wind_direction_10m_dominant",
];

async function fetchJson<T>(url: string, timeoutMs = 15000): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        accept: "application/json",
      },
    });
    if (!response.ok) {
      throw new Error(`Upstream responded ${response.status}`);
    }
    return (await response.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

function toNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function getArray(record: ApiObject | undefined, key: string): (number | null)[] {
  const value = record?.[key];
  if (!Array.isArray(value)) return [];
  return value.map((item) => toNumber(item));
}

function getTimeArray(record: ApiObject | undefined): string[] {
  const value = record?.time;
  return Array.isArray(value) ? value.map(String) : [];
}

function at(
  values: (number | null)[] | undefined,
  index: number,
  fallback: number | null = null,
): number | null {
  if (!values) return fallback;
  const direct = values[index];
  if (direct != null) return direct;
  for (let i = index - 1; i >= 0; i -= 1) {
    if (values[i] != null) return values[i];
  }
  for (let i = index + 1; i < values.length; i += 1) {
    if (values[i] != null) return values[i];
  }
  return fallback;
}

function samples(
  sources: InternalSource[],
  variable: string,
  index: number,
): WeightedValue[] {
  return sources.map((source) => ({
    value: at(source.hourly[variable], index),
    weight: source.influence,
  }));
}

function dailySamples(
  sources: InternalSource[],
  variable: string,
  index: number,
): WeightedValue[] {
  return sources.map((source) => ({
    value: at(source.daily[variable], index),
    weight: source.influence,
  }));
}

function weightedNumber(
  points: WeightedValue[],
  fallback = 0,
  trim = false,
  digits = 1,
): number {
  return round(weightedMean(points, trim) ?? fallback, digits);
}

function precipProbability(
  sources: InternalSource[],
  index: number,
): number {
  const probabilitySamples = sources
    .map((source) => ({
      value: at(source.hourly.precipitation_probability, index),
      weight: source.influence,
    }))
    .filter((point): point is { value: number; weight: number } => point.value != null);
  if (probabilitySamples.length) {
    return Math.round(clamp(weightedNumber(probabilitySamples, 0), 0, 100));
  }
  const wet = sources.filter((source) => (at(source.hourly.precipitation, index) ?? 0) >= 0.1);
  return Math.round((wet.length / Math.max(1, sources.length)) * 100);
}

function pickPivotIndex(times: string[], currentTime: string | undefined): number {
  if (!times.length) return 0;
  if (currentTime) {
    const exact = times.indexOf(currentTime);
    if (exact >= 0) return exact;
    const nearest = times.findIndex((time) => time >= currentTime);
    if (nearest >= 0) return nearest;
  }
  return 0;
}

function formatMinutes(date: string, minutes: number | null): string {
  if (minutes == null || !Number.isFinite(minutes)) return "";
  const normalised = ((minutes % 1440) + 1440) % 1440;
  const hours = Math.floor(normalised / 60);
  const mins = Math.floor(normalised % 60);
  return `${date}T${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;
}

function timeToMinutes(time: string | null | undefined): number | null {
  if (!time || !time.includes("T")) return null;
  const part = time.split("T")[1];
  const [hours, minutes] = part.split(":").map(Number);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
  return hours * 60 + minutes;
}

function medianSunTime(values: (string | null | undefined)[], date: string): string {
  const minutes = values
    .map((value) => timeToMinutes(value))
    .filter((value): value is number => value != null);
  return formatMinutes(date, median(minutes));
}

function aqiLevel(aqi: number): AqiLevel {
  if (aqi <= 20) return "good";
  if (aqi <= 40) return "fair";
  if (aqi <= 60) return "moderate";
  if (aqi <= 80) return "poor";
  if (aqi <= 100) return "very-poor";
  return "extreme";
}

function moonInfo(date: string): SunInfo["moon"] {
  const timestamp = Date.parse(`${date}T12:00:00Z`);
  const knownNewMoon = Date.UTC(2000, 0, 6, 18, 14);
  const days = (timestamp - knownNewMoon) / 86_400_000;
  const phase = ((days / 29.530588853) % 1 + 1) % 1;
  const illumination = ((1 - Math.cos(2 * Math.PI * phase)) / 2) * 100;

  let nameKey: SunInfo["moon"]["nameKey"];
  if (phase < 0.03 || phase >= 0.97) nameKey = "new";
  else if (phase < 0.22) nameKey = "waxingCrescent";
  else if (phase < 0.28) nameKey = "firstQuarter";
  else if (phase < 0.47) nameKey = "waxingGibbous";
  else if (phase < 0.53) nameKey = "full";
  else if (phase < 0.72) nameKey = "waningGibbous";
  else if (phase < 0.78) nameKey = "lastQuarter";
  else nameKey = "waningCrescent";

  return {
    phase: round(phase, 4),
    illumination: Math.round(illumination),
    nameKey,
  };
}

function buildAirQuality(air: ApiObject | null, currentTime: string | undefined): AirQuality | null {
  if (!air?.current) return null;
  const current = air.current;
  const aqi = toNumber(current.european_aqi);
  if (aqi == null) return null;

  const times = getTimeArray(air.hourly);
  const hourlyAqi = getArray(air.hourly, "european_aqi");
  let start = 0;
  if (currentTime) {
    const found = times.findIndex((time) => time >= currentTime);
    start = found >= 0 ? found : 0;
  }

  return {
    aqi: Math.round(aqi),
    usAqi: toNumber(current.us_aqi),
    level: aqiLevel(aqi),
    pm2_5: toNumber(current.pm2_5),
    pm10: toNumber(current.pm10),
    no2: toNumber(current.nitrogen_dioxide),
    so2: toNumber(current.sulphur_dioxide),
    o3: toNumber(current.ozone),
    co: toNumber(current.carbon_monoxide),
    pollen: {
      alder: toNumber(current.alder_pollen),
      birch: toNumber(current.birch_pollen),
      grass: toNumber(current.grass_pollen),
      mugwort: toNumber(current.mugwort_pollen),
      olive: toNumber(current.olive_pollen),
      ragweed: toNumber(current.ragweed_pollen),
    },
    hourlyAqi: hourlyAqi
      .slice(start, start + 24)
      .filter((value): value is number => value != null)
      .map((value) => Math.round(value)),
    updatedAt: String(current.time ?? currentTime ?? ""),
  };
}

function buildNowcast(nowcast: ApiObject | null, currentTime: string | undefined): NowcastPoint[] {
  const times = getTimeArray(nowcast?.minutely_15);
  const precipitation = getArray(nowcast?.minutely_15, "precipitation");
  const probability = getArray(nowcast?.minutely_15, "precipitation_probability");
  if (!times.length) return [];
  let start = 0;
  if (currentTime) {
    const found = times.findIndex((time) => time >= currentTime);
    start = found >= 0 ? found : 0;
  }
  return times.slice(start, start + 8).map((time, index) => ({
    time,
    precipitation: round(precipitation[start + index] ?? 0, 2),
    probability: Math.round(probability[start + index] ?? 0),
  }));
}

async function fetchWeatherData(query: WeatherQuery): Promise<WeatherPayload> {
  const profile = weightProfile(query.countryCode);
  const modelIds = MODELS.map((model) => model.apiId);
  const forecastParams = new URLSearchParams({
    latitude: String(query.latitude),
    longitude: String(query.longitude),
    models: modelIds.join(","),
    timezone: "auto",
    forecast_days: "10",
    hourly: HOURLY_VARIABLES.join(","),
    daily: DAILY_VARIABLES.join(","),
    current: "temperature_2m,weather_code",
  });

  const airParams = new URLSearchParams({
    latitude: String(query.latitude),
    longitude: String(query.longitude),
    timezone: "auto",
    forecast_days: "2",
    current:
      "european_aqi,us_aqi,pm2_5,pm10,nitrogen_dioxide,sulphur_dioxide,ozone,carbon_monoxide,uv_index,alder_pollen,birch_pollen,grass_pollen,mugwort_pollen,olive_pollen,ragweed_pollen",
    hourly: "european_aqi",
  });

  const nowcastParams = new URLSearchParams({
    latitude: String(query.latitude),
    longitude: String(query.longitude),
    timezone: "auto",
    minutely_15: "precipitation,precipitation_probability",
    forecast_minutely_15: "8",
  });

  const [forecastResult, airResult, nowcastResult] = await Promise.allSettled([
    fetchJson<ApiObject>(
      `https://api.open-meteo.com/v1/forecast?${forecastParams.toString()}`,
    ),
    fetchJson<ApiObject>(
      `https://air-quality-api.open-meteo.com/v1/air-quality?${airParams.toString()}`,
      12000,
    ),
    fetchJson<ApiObject>(
      `https://api.open-meteo.com/v1/forecast?${nowcastParams.toString()}`,
      12000,
    ),
  ]);

  if (forecastResult.status === "rejected") {
    throw new Error(`Forecast unavailable: ${forecastResult.reason}`);
  }

  const forecast = forecastResult.value;
  const air = airResult.status === "fulfilled" ? airResult.value : null;
  const nowcast = nowcastResult.status === "fulfilled" ? nowcastResult.value : null;

  const hourly = forecast.hourly as ApiObject | undefined;
  const daily = forecast.daily as ApiObject | undefined;
  const times = getTimeArray(hourly);
  const rawCurrentTime = forecast.current?.time ? String(forecast.current.time) : times[0];
  const currentTime =
    rawCurrentTime && rawCurrentTime.includes("T")
      ? `${rawCurrentTime.slice(0, 13)}:00`
      : rawCurrentTime;
  const pivotIndex = pickPivotIndex(times, currentTime);
  const countryCode = (query.countryCode || "").toUpperCase();

  const internalSources: InternalSource[] = MODELS.map((def) => {
    const priorWeight = profile[def.id] ?? 0.6;
    const hourlySeries: Record<string, (number | null)[]> = {};
    const dailySeries: Record<string, (number | null)[]> = {};
    const dailyTime: Record<string, (string | null)[]> = {};

    for (const variable of HOURLY_VARIABLES) {
      const values = getArray(hourly, `${variable}_${def.apiId}`);
      hourlySeries[variable] =
        variable === "visibility"
          ? values.map((value) => (value == null ? null : value / 1000))
          : values;
    }
    for (const variable of DAILY_VARIABLES) {
      if (variable === "sunrise" || variable === "sunset") continue;
      dailySeries[variable] = getArray(daily, `${variable}_${def.apiId}`);
    }
    for (const variable of ["sunrise", "sunset"]) {
      const raw = daily?.[`${variable}_${def.apiId}`];
      dailyTime[variable] = Array.isArray(raw)
        ? raw.map((value) => (value == null ? null : String(value)))
        : [];
    }

    const current: Record<string, number | null> = {};
    for (const variable of HOURLY_VARIABLES) {
      current[variable] = at(hourlySeries[variable], pivotIndex);
    }

    const availableSource =
      current.temperature_2m != null &&
      hourlySeries.temperature_2m.filter((value) => value != null).length >= 12;

    return {
      def,
      priorWeight,
      influence: 0,
      available: availableSource,
      hourly: hourlySeries,
      daily: dailySeries,
      dailyTime,
      current,
    };
  });

  const liveSources = internalSources.filter((source) => source.available);
  if (!liveSources.length) {
    throw new Error("No weather model returned usable data for this location.");
  }

  const weights = normaliseWeights(
    liveSources.map((source) => ({ id: source.def.id, priorWeight: source.priorWeight })),
  );
  for (const source of liveSources) {
    source.influence = weights.find((entry) => entry.id === source.def.id)?.influence ?? 0;
  }

  const tempAtPivot = samples(liveSources, "temperature_2m", pivotIndex);
  const consensusTemp = weightedMean(tempAtPivot, true) ?? 0;
  const currentSpread = weightedStd(tempAtPivot);

  const currentCode =
    weightedModeCode(samples(liveSources, "weather_code", pivotIndex)) ?? 3;
  const currentIsDay = mostCommonBoolean(
    samples(liveSources, "is_day", pivotIndex).map((point) => ({
      value: point.value == null ? null : point.value >= 0.5,
      weight: point.weight,
    })),
  );

  const hourlyTimes = times.slice(pivotIndex, pivotIndex + 48);
  const hourlyPoints: HourlyPoint[] = [];
  const confidences: number[] = [];

  for (let offset = 0; offset < hourlyTimes.length; offset += 1) {
    const index = pivotIndex + offset;
    const tempSpread = weightedStd(samples(liveSources, "temperature_2m", index));
    const temp = weightedNumber(samples(liveSources, "temperature_2m", index), consensusTemp, true);
    const precipPairs = liveSources.map((source) => ({
      precipitation: at(source.hourly.precipitation, index),
      probability: at(source.hourly.precipitation_probability, index),
    }));
    const confidence = hourConfidence(tempSpread, precipPairs, liveSources.length);
    confidences.push(confidence);

    const prev = hourlyPoints[offset - 1];
    const code = weightedModeCode(samples(liveSources, "weather_code", index)) ?? currentCode;
    const point: HourlyPoint = {
      time: hourlyTimes[offset],
      temp,
      apparent: weightedNumber(
        samples(liveSources, "apparent_temperature", index),
        temp,
        true,
      ),
      code,
      isDay: mostCommonBoolean(
        samples(liveSources, "is_day", index).map((p) => ({
          value: p.value == null ? null : p.value >= 0.5,
          weight: p.weight,
        })),
      ),
      precipitation: weightedNumber(
        samples(liveSources, "precipitation", index),
        0,
        false,
        2,
      ),
      precipitationProbability: precipProbability(liveSources, index),
      snow: weightedNumber(samples(liveSources, "snowfall", index), 0, false, 2),
      windSpeed: weightedNumber(samples(liveSources, "wind_speed_10m", index), 0),
      windGust: weightedNumber(samples(liveSources, "wind_gusts_10m", index), 0),
      windDirection:
        circularMean(samples(liveSources, "wind_direction_10m", index)) ??
        prev?.windDirection ??
        0,
      humidity: Math.round(
        weightedNumber(samples(liveSources, "relative_humidity_2m", index), 60),
      ),
      dewPoint: weightedNumber(
        samples(liveSources, "dew_point_2m", index),
        prev?.dewPoint ?? temp - 4,
      ),
      pressure: weightedNumber(
        samples(liveSources, "pressure_msl", index),
        prev?.pressure ?? 1013,
      ),
      visibility: weightedNumber(
        samples(liveSources, "visibility", index),
        prev?.visibility ?? 20,
        false,
        2,
      ),
      uvIndex: weightedNumber(samples(liveSources, "uv_index", index), 0, false, 1),
      cloudCover: Math.round(
        weightedNumber(samples(liveSources, "cloud_cover", index), 50),
      ),
      confidence,
      spread: round(tempSpread ?? 0, 1),
    };
    hourlyPoints.push(point);
  }

  const dailyTimes = getTimeArray(daily);
  const dailyPoints: DailyPoint[] = [];
  for (let index = 0; index < dailyTimes.length; index += 1) {
    const date = dailyTimes[index];
    const spreadValues = [
      weightedStd(dailySamples(liveSources, "temperature_2m_max", index)),
      weightedStd(dailySamples(liveSources, "temperature_2m_min", index)),
    ].filter((value): value is number => value != null);
    const spread =
      spreadValues.length > 0
        ? spreadValues.reduce((sum, value) => sum + value, 0) / spreadValues.length
        : 0;
    const probabilities = liveSources
      .map((source) => at(source.daily.precipitation_probability_max, index))
      .filter((value): value is number => value != null);
    const probabilitySpread = standardDeviation(probabilities) ?? 0;
    const confidence = Math.round(
      clamp(
        temperatureAgreement(spread, liveSources.length) * 0.78 +
          clamp(100 - probabilitySpread * 1.05, 25, 100) * 0.22,
        25,
        98,
      ),
    );
    const sunrise = medianSunTime(
      liveSources.map((source) => source.dailyTime.sunrise?.[index] ?? null),
      date,
    );
    const sunset = medianSunTime(
      liveSources.map((source) => source.dailyTime.sunset?.[index] ?? null),
      date,
    );

    dailyPoints.push({
      date,
      code: weightedModeCode(dailySamples(liveSources, "weather_code", index)) ?? 3,
      max: weightedNumber(dailySamples(liveSources, "temperature_2m_max", index), consensusTemp, true),
      min: weightedNumber(dailySamples(liveSources, "temperature_2m_min", index), consensusTemp, true),
      apparentMax: weightedNumber(
        dailySamples(liveSources, "apparent_temperature_max", index),
        consensusTemp,
        true,
      ),
      apparentMin: weightedNumber(
        dailySamples(liveSources, "apparent_temperature_min", index),
        consensusTemp,
        true,
      ),
      precipitationSum: weightedNumber(
        dailySamples(liveSources, "precipitation_sum", index),
        0,
        false,
        1,
      ),
      precipitationProbability: Math.round(
        weightedNumber(dailySamples(liveSources, "precipitation_probability_max", index), 0),
      ),
      precipitationHours: weightedNumber(
        dailySamples(liveSources, "precipitation_hours", index),
        0,
        false,
        0,
      ),
      windMax: weightedNumber(dailySamples(liveSources, "wind_speed_10m_max", index), 0),
      gustMax: weightedNumber(dailySamples(liveSources, "wind_gusts_10m_max", index), 0),
      windDirection:
        circularMean(dailySamples(liveSources, "wind_direction_10m_dominant", index)) ?? 0,
      uvMax: weightedNumber(dailySamples(liveSources, "uv_index_max", index), 0, false, 1),
      sunrise,
      sunset,
      confidence,
      spread: round(spread, 1),
    });
  }

  const today = dailyPoints[0];
  const high = today?.max ?? consensusTemp + 2;
  const low = today?.min ?? consensusTemp - 2;
  const agreement = Math.round(
    confidences.slice(0, 24).reduce((sum, value) => sum + value, 0) /
      Math.max(1, Math.min(24, confidences.length)),
  );

  const current: CurrentWeather = {
    time: currentTime ?? hourlyTimes[0] ?? "",
    temp: round(consensusTemp, 1),
    apparent: weightedNumber(
      samples(liveSources, "apparent_temperature", pivotIndex),
      consensusTemp,
      true,
    ),
    code: currentCode,
    isDay: currentIsDay,
    precipitation: weightedNumber(samples(liveSources, "precipitation", pivotIndex), 0, false, 2),
    precipitationProbability: precipProbability(liveSources, pivotIndex),
    windSpeed: weightedNumber(samples(liveSources, "wind_speed_10m", pivotIndex), 0),
    windGust: weightedNumber(samples(liveSources, "wind_gusts_10m", pivotIndex), 0),
    windDirection:
      Math.round(
        circularMean(samples(liveSources, "wind_direction_10m", pivotIndex)) ?? 0,
      ) % 360,
    humidity: Math.round(
      weightedNumber(samples(liveSources, "relative_humidity_2m", pivotIndex), 60),
    ),
    dewPoint: weightedNumber(
      samples(liveSources, "dew_point_2m", pivotIndex),
      consensusTemp - 4,
    ),
    pressure: weightedNumber(samples(liveSources, "pressure_msl", pivotIndex), 1013),
    visibility: weightedNumber(samples(liveSources, "visibility", pivotIndex), 20, false, 2),
    uvIndex: weightedNumber(samples(liveSources, "uv_index", pivotIndex), 0, false, 1),
    cloudCover: Math.round(
      weightedNumber(samples(liveSources, "cloud_cover", pivotIndex), 50),
    ),
    high,
    low,
    confidence: agreement,
    agreement,
    spread: round(currentSpread ?? 0, 1),
    sourceCount: liveSources.length,
  };

  const sourceSeries: SourceSeries[] = internalSources.map((source) => {
    const currentTemp = source.current.temperature_2m;
    const availableSource = source.available;
    const meanAbsDeviation = availableSource
      ? (() => {
          const deviations = Array.from({ length: Math.min(24, hourlyPoints.length) })
            .map((_, offset) => {
              const own = at(source.hourly.temperature_2m, pivotIndex + offset);
              const consensus = hourlyPoints[offset]?.temp;
              return own != null && consensus != null ? Math.abs(own - consensus) : null;
            })
            .filter((value): value is number => value != null);
          return deviations.length
            ? round(deviations.reduce((sum, value) => sum + value, 0) / deviations.length, 2)
            : null;
        })()
      : null;

    const currentValues: SourceCurrent = {
      temp: currentTemp == null ? null : round(currentTemp, 1),
      apparent:
        source.current.apparent_temperature == null
          ? null
          : round(source.current.apparent_temperature, 1),
      code: source.current.weather_code == null ? null : Math.round(source.current.weather_code),
      isDay: (source.current.is_day ?? 1) >= 0.5,
      precipitation:
        source.current.precipitation == null ? null : round(source.current.precipitation, 2),
      windSpeed:
        source.current.wind_speed_10m == null ? null : round(source.current.wind_speed_10m, 1),
      windGust:
        source.current.wind_gusts_10m == null ? null : round(source.current.wind_gusts_10m, 1),
      windDirection:
        source.current.wind_direction_10m == null
          ? null
          : Math.round(source.current.wind_direction_10m),
      humidity:
        source.current.relative_humidity_2m == null
          ? null
          : Math.round(source.current.relative_humidity_2m),
      pressure:
        source.current.pressure_msl == null ? null : round(source.current.pressure_msl, 1),
      visibility:
        source.current.visibility == null ? null : round(source.current.visibility, 1),
      uvIndex: source.current.uv_index == null ? null : round(source.current.uv_index, 1),
      cloudCover:
        source.current.cloud_cover == null ? null : Math.round(source.current.cloud_cover),
    };

    return {
      ...source.def,
      available: availableSource,
      current: currentValues,
      priorWeight: source.priorWeight,
      influence: source.influence,
      deviation:
        currentTemp == null ? null : round(currentTemp - consensusTemp, 1),
      meanAbsDeviation,
      hourlyTemp: source.hourly.temperature_2m.slice(pivotIndex, pivotIndex + 48),
      hourlyPrecip: source.hourly.precipitation.slice(pivotIndex, pivotIndex + 48),
      hourlyPrecipProbability: source.hourly.precipitation_probability.slice(
        pivotIndex,
        pivotIndex + 48,
      ),
      hourlyWind: source.hourly.wind_speed_10m.slice(pivotIndex, pivotIndex + 48),
      hourlyCode: source.hourly.weather_code.slice(pivotIndex, pivotIndex + 48),
      dailyHigh: source.daily.temperature_2m_max.slice(0, 10).map((value) =>
        value == null ? null : round(value, 1),
      ),
      dailyLow: source.daily.temperature_2m_min.slice(0, 10).map((value) =>
        value == null ? null : round(value, 1),
      ),
      dailyPrecip: source.daily.precipitation_sum.slice(0, 10).map((value) =>
        value == null ? null : round(value, 1),
      ),
    };
  });

  const firstDay = dailyPoints[0]?.date ?? new Date().toISOString().slice(0, 10);
  const sunrise = dailyPoints[0]?.sunrise ?? "";
  const sunset = dailyPoints[0]?.sunset ?? "";
  const sunriseMinutes = timeToMinutes(sunrise);
  const sunsetMinutes = timeToMinutes(sunset);
  const daylightSeconds =
    sunriseMinutes != null && sunsetMinutes != null
      ? Math.max(0, sunsetMinutes - sunriseMinutes) * 60
      : dailyPoints[0]?.sunrise
        ? 0
        : 0;
  const solarNoon =
    sunriseMinutes != null && sunsetMinutes != null
      ? formatMinutes(firstDay, sunriseMinutes + (sunsetMinutes - sunriseMinutes) / 2)
      : "";

  const sun: SunInfo = {
    sunrise,
    sunset,
    daylightSeconds,
    solarNoon,
    moon: moonInfo(firstDay),
  };

  const generatedAt = new Date();
  const meta: WeatherMeta = {
    generatedAt: generatedAt.toISOString(),
    expiresAt: new Date(generatedAt.getTime() + CACHE_TTL_MS).toISOString(),
    mode: "live",
    timezone: String(forecast.timezone ?? query.timezone ?? "auto"),
    timezoneAbbreviation: String(forecast.timezone_abbreviation ?? ""),
    utcOffsetSeconds: Number(forecast.utc_offset_seconds ?? 0),
    elevation: Number(forecast.elevation ?? query.elevation ?? 0),
    requested: { latitude: query.latitude, longitude: query.longitude },
    resolved: {
      latitude: Number(forecast.latitude ?? query.latitude),
      longitude: Number(forecast.longitude ?? query.longitude),
    },
    modelCount: liveSources.length,
    attribution:
      "Open-Meteo · ECMWF, DWD, Met Office, Météo-France, KNMI, MET Norway, DMI, BOM, NOAA, ECCC, JMA, CMA",
  };

  const location: Place = {
    name: query.name,
    country: query.country || countryCode,
    countryCode,
    admin1: query.admin1,
    latitude: query.latitude,
    longitude: query.longitude,
    timezone: meta.timezone,
    elevation: meta.elevation,
  };

  return {
    location,
    meta,
    current,
    hourly: hourlyPoints,
    daily: dailyPoints,
    sources: sourceSeries,
    airQuality: buildAirQuality(air, currentTime),
    nowcast: buildNowcast(nowcast, currentTime),
    sun,
  };
}

function cacheKey(query: WeatherQuery): string {
  return `${query.latitude.toFixed(3)}:${query.longitude.toFixed(3)}:${query.countryCode.toUpperCase()}`;
}

export async function getWeather(
  query: WeatherQuery,
  { force = false }: { force?: boolean } = {},
): Promise<WeatherPayload & { cacheState: "fresh" | "hit" | "stale" }> {
  const key = cacheKey(query);
  const cached = cache.get(key);
  const now = Date.now();

  if (!force && cached && cached.expiresAt > now) {
    return {
      ...cached.payload,
      meta: { ...cached.payload.meta, mode: "live" },
      cacheState: "hit",
    };
  }

  const running = inFlight.get(key);
  if (running) {
    const payload = await running;
    return { ...payload, cacheState: "fresh" };
  }

  const job = fetchWeatherData(query)
    .then((payload) => {
      cache.set(key, { payload, expiresAt: Date.now() + CACHE_TTL_MS });
      if (cache.size > 120) {
        const oldest = [...cache.entries()].sort((a, b) => a[1].expiresAt - b[1].expiresAt)[0];
        if (oldest) cache.delete(oldest[0]);
      }
      return payload;
    })
    .finally(() => {
      inFlight.delete(key);
    });

  inFlight.set(key, job);

  try {
    const payload = await job;
    return { ...payload, cacheState: "fresh" };
  } catch (error) {
    if (cached) {
      return {
        ...cached.payload,
        meta: { ...cached.payload.meta, mode: "cache" },
        cacheState: "stale",
      };
    }
    throw error;
  }
}

export { buildAirQuality, moonInfo, aqiLevel };
