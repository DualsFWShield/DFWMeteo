import { geocode, reverseGeocode } from "../server/geocode.ts";
import { getWeather } from "../server/weather.ts";

/**
 * GitHub Pages runs without the Express server. This entry bundles the same
 * consensus engine into the page and calls the Open-Meteo/BigDataCloud APIs
 * directly (both are CORS-enabled).
 */
const api = {
  weather: getWeather,
  geocode,
  reverseGeocode,
};

(globalThis as typeof globalThis & { DFWMeteoApi?: typeof api }).DFWMeteoApi = api;
