import { App as CapacitorApp } from "@capacitor/app";
import { geocode, reverseGeocode } from "../server/geocode.ts";
import { getWeather } from "../server/weather.ts";
import { parseIrmForecast, irmCodeToWmo } from "../server/irm-core.ts";

/**
 * GitHub Pages & native Capacitor builds run without the Express server.
 * This entry bundles the consensus engine and Capacitor plugins into the page.
 */
const api = {
  weather: getWeather,
  geocode,
  reverseGeocode,
  parseIrmForecast,
  irmCodeToWmo,
  App: CapacitorApp,
};

(globalThis as typeof globalThis & { DFWMeteoApi?: typeof api; CapacitorApp?: typeof CapacitorApp }).DFWMeteoApi = api;
(globalThis as typeof globalThis & { CapacitorApp?: typeof CapacitorApp }).CapacitorApp = CapacitorApp;

