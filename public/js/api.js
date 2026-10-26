function staticApi() {
  return window.DFWMETEO_STATIC === true && window.DFWMeteoApi ? window.DFWMeteoApi : null;
}

function throwIfAborted(signal) {
  if (signal?.aborted) {
    throw new DOMException("Aborted", "AbortError");
  }
}

let irmSnapshotPromise = null;

function distanceKm(a, b) {
  const radius = 6371;
  const toRad = (value) => (value * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * radius * Math.asin(Math.sqrt(h));
}

async function loadIrmSnapshot(place) {
  if (!staticApi()) return null;
  if (
    place.countryCode !== "BE" &&
    !(
      place.countryCode === "" &&
      place.latitude >= 49.45 &&
      place.latitude <= 51.55 &&
      place.longitude >= 2.45 &&
      place.longitude <= 6.5
    )
  ) {
    return null;
  }
  if (!irmSnapshotPromise) {
    irmSnapshotPromise = fetch("./data/irm.json", {
      headers: { accept: "application/json" },
      cache: "no-store",
    })
      .then((response) => (response.ok ? response.json() : null))
      .catch(() => null);
  }
  const snapshot = await irmSnapshotPromise;
  if (!snapshot?.cities?.length) return null;
  let nearest = null;
  let nearestDistance = Infinity;
  for (const city of snapshot.cities) {
    if (!city.official) continue;
    const distance = distanceKm(place, city);
    if (distance < nearestDistance) {
      nearest = city;
      nearestDistance = distance;
    }
  }
  if (!nearest || nearestDistance > 30) return null;
  return {
    ...nearest.official,
    latitude: Number(place.latitude),
    longitude: Number(place.longitude),
    distanceKm: Math.round(nearestDistance * 10) / 10,
    snapshotAt: snapshot.generatedAt,
    mode: "snapshot",
  };
}

async function requestJson(url, { signal, timeout = 20000 } = {}) {
  const timeoutSignal = AbortSignal.timeout(timeout);
  const combined = signal ? AbortSignal.any([signal, timeoutSignal]) : timeoutSignal;
  const response = await fetch(url, {
    signal: combined,
    headers: { accept: "application/json" },
    cache: "no-store",
  });
  if (!response.ok) {
    let detail = null;
    try {
      detail = await response.json();
    } catch {
      detail = null;
    }
    const error = new Error(detail?.message || `Request failed (${response.status})`);
    error.status = response.status;
    throw error;
  }
  return response.json();
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

export async function fetchWeather(place, { signal, force = false } = {}) {
  throwIfAborted(signal);
  const client = staticApi();
  if (client) {
    const payload = await client.weather(
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
    const official = await loadIrmSnapshot(place);
    throwIfAborted(signal);
    return official ? { ...payload, official } : payload;
  }
  const query = `${placeToQuery(place)}${force ? "&force=1" : ""}`;
  return requestJson(`/api/weather?${query}`, { signal });
}

export async function searchPlaces(query, language = "en", { signal } = {}) {
  throwIfAborted(signal);
  const client = staticApi();
  if (client) {
    const response = await client.geocode(query, language);
    throwIfAborted(signal);
    return response.results ?? [];
  }
  const params = new URLSearchParams({
    q: query,
    lang: language,
  });
  const response = await requestJson(`/api/geocode?${params.toString()}`, {
    signal,
    timeout: 12000,
  });
  return response.results ?? [];
}

export async function reversePlace(latitude, longitude, language = "en", { signal } = {}) {
  throwIfAborted(signal);
  const client = staticApi();
  if (client) {
    const place = await client.reverseGeocode(latitude, longitude, language);
    throwIfAborted(signal);
    return place;
  }
  const params = new URLSearchParams({
    lat: String(latitude),
    lon: String(longitude),
    lang: language,
  });
  return requestJson(`/api/reverse?${params.toString()}`, { signal, timeout: 10000 });
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
