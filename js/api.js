/**
 * DFWMeteo Client API Coordinator
 * Directly coordinates the weather consensus engine, geocoding, rain grid, and IRM official layer.
 */

import { getWeather } from "./weather.js";
import { getPrecipMap } from "./precip-grid.js";
import { geocode, reverseGeocode } from "./geocode.js";
import { fetchIrmOfficial } from "./irm.js";

function throwIfAborted(signal) {
  if (signal?.aborted) {
    throw new DOMException("Aborted", "AbortError");
  }
}

export function placeToQuery(place) {
  const params = new URLSearchParams({
    lat: String(place.latitude),
    lon: String(place.longitude),
    name: place.name || "Selected location",
    country: place.country || "",
    countryCode: place.countryCode || "",
  });
  if (place.admin1) params.set("admin1", place.admin1);
  if (place.timezone) params.set("timezone", place.timezone);
  return params.toString();
}

export async function fetchWeather(place, { signal, force = false, lang = "en" } = {}) {
  throwIfAborted(signal);
  const payload = await getWeather(
    {
      latitude: Number(place.latitude),
      longitude: Number(place.longitude),
      name: place.name || "Selected location",
      country: place.country || "",
      countryCode: place.countryCode || "",
      admin1: place.admin1,
      timezone: place.timezone,
    },
    { force },
  );
  throwIfAborted(signal);

  const official = await fetchIrmOfficial(place, lang, { force }).catch(() => null);
  throwIfAborted(signal);

  return official ? { ...payload, official } : payload;
}

export async function fetchPrecipitationMap(latitude, longitude, { signal, force = false } = {}) {
  throwIfAborted(signal);
  const payload = await getPrecipMap(Number(latitude), Number(longitude), { force });
  throwIfAborted(signal);
  return payload;
}

export async function searchPlaces(query, language = "en", { signal } = {}) {
  throwIfAborted(signal);
  const response = await geocode(query, language);
  throwIfAborted(signal);
  return response.results ?? [];
}

export async function reversePlace(latitude, longitude, language = "en", { signal } = {}) {
  throwIfAborted(signal);
  const place = await reverseGeocode(Number(latitude), Number(longitude), language);
  throwIfAborted(signal);
  return place;
}

export function placeKey(place) {
  return `${Number(place.latitude).toFixed(3)},${Number(place.longitude).toFixed(3)}`;
}

export function placeFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const latitude = Number(params.get("lat"));
  const longitude = Number(params.get("lon"));
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  return {
    latitude,
    longitude,
    name: params.get("name") || "Selected location",
    country: params.get("country") || "",
    countryCode: (params.get("countryCode") || "").toUpperCase(),
    admin1: params.get("admin1") || undefined,
  };
}

export function writePlaceToUrl(place) {
  const params = new URLSearchParams();
  params.set("lat", Number(place.latitude).toFixed(4));
  params.set("lon", Number(place.longitude).toFixed(4));
  params.set("name", place.name || "");
  if (place.country) params.set("country", place.country);
  if (place.countryCode) params.set("countryCode", place.countryCode);
  if (place.admin1) params.set("admin1", place.admin1);
  const next = `${window.location.pathname}?${params.toString()}`;
  window.history.replaceState(null, "", next);
}
