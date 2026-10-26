import { getWeather } from "../server/weather.ts";

const result = await getWeather({
  latitude: 50.8503,
  longitude: 4.3517,
  name: "Brussels",
  country: "Belgium",
  countryCode: "BE",
});

const summary = {
  mode: result.meta.mode,
  cacheState: result.cacheState,
  location: result.location,
  meta: result.meta,
  current: result.current,
  hourly: result.hourly.slice(0, 4),
  daily: result.daily.slice(0, 3),
  sources: result.sources.map((source) => ({
    id: source.id,
    temp: source.current.temp,
    code: source.current.code,
    influence: Number(source.influence.toFixed(3)),
    deviation: source.deviation,
    meanAbsDeviation: source.meanAbsDeviation,
    available: source.available,
  })),
  airQuality: result.airQuality,
  sun: result.sun,
  nowcast: result.nowcast,
};

console.log(JSON.stringify(summary, null, 2));
console.log("hourly count:", result.hourly.length, "daily count:", result.daily.length);
