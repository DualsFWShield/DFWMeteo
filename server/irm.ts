import crypto from "node:crypto";
import type { OfficialSource } from "../shared/types.ts";
import { parseIrmForecast } from "./irm-core.ts";

const BASE = "https://app.meteo.be/services/appv4/";
const TTL_MS = 10 * 60 * 1000;
const CACHE_LIMIT = 60;
const cache = new Map<string, { expiresAt: number; value: OfficialSource }>();

export function isBelgiumCoordinate(latitude: number, longitude: number): boolean {
  return latitude >= 49.45 && latitude <= 51.55 && longitude >= 2.45 && longitude <= 6.5;
}

function belgianDateKey(date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Brussels",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.day}/${values.month}/${values.year}`;
}

function apiKey(): string {
  return crypto
    .createHash("md5")
    .update(`r9EnW374jkJ9acc;getForecasts;${belgianDateKey()}`)
    .digest("hex");
}

async function fetchIrmRaw(latitude: number, longitude: number): Promise<any> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 9000);
  try {
    const params = new URLSearchParams({
      s: "getForecasts",
      k: apiKey(),
      lat: latitude.toFixed(6),
      long: longitude.toFixed(6),
    });
    const response = await fetch(`${BASE}?${params.toString()}`, {
      signal: controller.signal,
      headers: {
        accept: "application/json",
        "user-agent": "DFWMeteoWeather/1.0 (official IRM reference layer)",
      },
    });
    if (!response.ok) throw new Error(`IRM responded ${response.status}`);
    return response.json();
  } finally {
    clearTimeout(timer);
  }
}

export async function getIrmOfficial(
  latitude: number,
  longitude: number,
  lang: "en" | "fr" | "nl" = "en",
): Promise<OfficialSource | null> {
  if (!isBelgiumCoordinate(latitude, longitude)) return null;
  const key = `${latitude.toFixed(3)}:${longitude.toFixed(3)}:${lang}`;
  const cached = cache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.value;

  try {
    const raw = await fetchIrmRaw(latitude, longitude);
    const official = parseIrmForecast({
      raw,
      latitude,
      longitude,
      distanceKm: 0,
      lang,
      mode: "live",
    });
    if (!official) return null;
    cache.set(key, { expiresAt: Date.now() + TTL_MS, value: official });
    if (cache.size > CACHE_LIMIT) {
      const oldest = [...cache.entries()].sort((a, b) => a[1].expiresAt - b[1].expiresAt)[0];
      if (oldest) cache.delete(oldest[0]);
    }
    return official;
  } catch {
    return null;
  }
}
