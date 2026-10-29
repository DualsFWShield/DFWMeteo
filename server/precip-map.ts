import type { PrecipMap, PrecipMapFrame } from "../shared/types.ts";

/**
 * A compact rain-zone grid around the selected place. Open-Meteo accepts
 * comma-separated coordinates, so one upstream request returns the whole grid.
 */
const ROWS = 10;
const COLS = 10;
const LAT_SPAN = 2.6;
const FRAME_COUNT = 24;
const CACHE_TTL_MS = 10 * 60 * 1000;

interface CacheEntry {
  map: PrecipMap;
  expiresAt: number;
}

interface LocationResponse {
  latitude?: number;
  longitude?: number;
  timezone?: string;
  utc_offset_seconds?: number;
  hourly?: {
    time?: string[];
    precipitation?: (number | null)[];
  };
}

const cache = new Map<string, CacheEntry>();
const inFlight = new Map<string, Promise<PrecipMap>>();

async function fetchJson<T>(url: string, timeoutMs = 18000): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { accept: "application/json" },
    });
    if (!response.ok) {
      throw new Error(`Upstream responded ${response.status}`);
    }
    return (await response.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function cacheKey(latitude: number, longitude: number): string {
  return `${latitude.toFixed(2)}:${longitude.toFixed(2)}`;
}

async function fetchPrecipMap(latitude: number, longitude: number): Promise<PrecipMap> {
  const centerLat = clamp(latitude, -80, 80);
  const centerLon = clamp(longitude, -179, 179);
  const halfLat = LAT_SPAN / 2;
  const cosLat = Math.max(0.25, Math.cos((centerLat * Math.PI) / 180));
  const lonSpan = Math.min(6, LAT_SPAN / cosLat);
  const halfLon = lonSpan / 2;

  const north = centerLat + halfLat;
  const south = centerLat - halfLat;
  const west = Math.max(-180, centerLon - halfLon);
  const east = Math.min(180, centerLon + halfLon);

  const lats: number[] = [];
  const lons: number[] = [];
  for (let row = 0; row < ROWS; row += 1) {
    lats.push(Number((north - (row / (ROWS - 1)) * (north - south)).toFixed(3)));
  }
  for (let col = 0; col < COLS; col += 1) {
    lons.push(Number((west + (col / (COLS - 1)) * (east - west)).toFixed(3)));
  }

  const requestLats: number[] = [];
  const requestLons: number[] = [];
  for (const lat of lats) {
    for (const lon of lons) {
      requestLats.push(lat);
      requestLons.push(lon);
    }
  }

  const params = new URLSearchParams({
    latitude: requestLats.join(","),
    longitude: requestLons.join(","),
    hourly: "precipitation",
    forecast_hours: String(FRAME_COUNT),
    timezone: "auto",
  });

  const payload = await fetchJson<LocationResponse | LocationResponse[]>(
    `https://api.open-meteo.com/v1/forecast?${params.toString()}`,
  );
  const locations = Array.isArray(payload) ? payload : [payload];
  if (!locations.length) {
    throw new Error("No precipitation data returned");
  }

  const times = locations[0]?.hourly?.time ?? [];
  const frames: PrecipMapFrame[] = [];
  for (let index = 0; index < Math.min(FRAME_COUNT, times.length); index += 1) {
    const values: number[] = [];
    for (const location of locations) {
      const raw = location.hourly?.precipitation?.[index];
      const value = typeof raw === "number" && Number.isFinite(raw) ? raw : 0;
      values.push(Math.round(value * 100) / 100);
    }
    while (values.length < ROWS * COLS) values.push(0);
    const max = values.reduce((highest, value) => Math.max(highest, value), 0);
    frames.push({ time: times[index], values, max: Math.round(max * 100) / 100 });
  }

  if (!frames.length) {
    throw new Error("No precipitation frames returned");
  }

  return {
    generatedAt: new Date().toISOString(),
    timezone: String(locations[0]?.timezone ?? "UTC"),
    utcOffsetSeconds: Number(locations[0]?.utc_offset_seconds ?? 0),
    center: { latitude: centerLat, longitude: centerLon },
    bounds: {
      north: Number(north.toFixed(3)),
      south: Number(south.toFixed(3)),
      east: Number(east.toFixed(3)),
      west: Number(west.toFixed(3)),
    },
    rows: ROWS,
    cols: COLS,
    lats,
    lons,
    frames,
    attribution:
      "Rain zones: Open-Meteo hourly precipitation. Basemap © OpenStreetMap contributors, © CARTO.",
  };
}

export async function getPrecipMap(latitude: number, longitude: number): Promise<PrecipMap> {
  const key = cacheKey(latitude, longitude);
  const cached = cache.get(key);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.map;
  }

  const pending = inFlight.get(key);
  if (pending) return pending;

  const promise = fetchPrecipMap(latitude, longitude)
    .then((map) => {
      cache.set(key, { map, expiresAt: Date.now() + CACHE_TTL_MS });
      if (cache.size > 40) {
        const now = Date.now();
        for (const [entryKey, entry] of cache) {
          if (entry.expiresAt <= now) cache.delete(entryKey);
        }
      }
      return map;
    })
    .finally(() => {
      inFlight.delete(key);
    });

  inFlight.set(key, promise);
  return promise;
}
