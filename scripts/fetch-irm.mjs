import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseIrmForecast } from "../server/irm-core.ts";

const BASE = "https://app.meteo.be/services/appv4/";

// Belgian centres used for the static GitHub Pages snapshot. The nearest centre
// is only attached within 30 km, and is shown as an official reference layer.
export const IRM_CITIES = [
  { name: "Brussels", latitude: 50.8503, longitude: 4.3517 },
  { name: "Antwerp", latitude: 51.2194, longitude: 4.4025 },
  { name: "Ghent", latitude: 51.0543, longitude: 3.7174 },
  { name: "Liège", latitude: 50.6326, longitude: 5.5797 },
  { name: "Bruges", latitude: 51.2093, longitude: 3.2247 },
  { name: "Namur", latitude: 50.4674, longitude: 4.8718 },
  { name: "Leuven", latitude: 50.8798, longitude: 4.7005 },
  { name: "Charleroi", latitude: 50.4114, longitude: 4.4445 },
  { name: "Mechelen", latitude: 51.0259, longitude: 4.4776 },
  { name: "Hasselt", latitude: 50.9307, longitude: 5.3378 },
  { name: "Kortrijk", latitude: 50.828, longitude: 3.2649 },
  { name: "Ostend", latitude: 51.2154, longitude: 2.9287 },
  { name: "Mons", latitude: 50.4542, longitude: 3.9567 },
  { name: "Tournai", latitude: 50.6057, longitude: 3.3883 },
  { name: "Arlon", latitude: 49.6833, longitude: 5.8167 },
  { name: "Bastogne", latitude: 50.0035, longitude: 5.7183 },
  { name: "Verviers", latitude: 50.5932, longitude: 5.8659 },
  { name: "Spa", latitude: 50.4924, longitude: 5.8643 },
  { name: "Dinant", latitude: 50.2611, longitude: 4.9122 },
  { name: "Marche-en-Famenne", latitude: 50.2268, longitude: 5.3444 },
  { name: "Wavre", latitude: 50.7172, longitude: 4.6083 },
  { name: "Nivelles", latitude: 50.5977, longitude: 4.3236 },
  { name: "Aalst", latitude: 50.9383, longitude: 4.0392 },
  { name: "Sint-Niklaas", latitude: 51.1644, longitude: 4.1406 },
  { name: "Roeselare", latitude: 50.9445, longitude: 3.1238 },
  { name: "Genk", latitude: 50.9655, longitude: 5.5008 },
  { name: "Turnhout", latitude: 51.3225, longitude: 4.9447 },
  { name: "Ieper", latitude: 50.8511, longitude: 2.8858 },
  { name: "Koksijde", latitude: 51.1044, longitude: 2.6456 },
  { name: "Sint-Truiden", latitude: 50.8165, longitude: 5.1874 },
  { name: "Eupen", latitude: 50.6306, longitude: 6.0319 },
  { name: "Huy", latitude: 50.5186, longitude: 5.2333 },
  { name: "Chimay", latitude: 50.0489, longitude: 4.3139 },
  { name: "Libramont", latitude: 49.9167, longitude: 5.3833 },
];

function belgianDateKey(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Brussels",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.day}/${values.month}/${values.year}`;
}

function apiKey() {
  return crypto
    .createHash("md5")
    .update(`r9EnW374jkJ9acc;getForecasts;${belgianDateKey()}`)
    .digest("hex");
}

async function fetchCity(city) {
  const params = new URLSearchParams({
    s: "getForecasts",
    k: apiKey(),
    lat: city.latitude.toFixed(6),
    long: city.longitude.toFixed(6),
  });
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);
  try {
    const response = await fetch(`${BASE}?${params.toString()}`, {
      signal: controller.signal,
      headers: {
        accept: "application/json",
        "user-agent": "DFWMeteoWeather/1.0 (GitHub Pages official IRM snapshot)",
      },
    });
    if (!response.ok) throw new Error(`IRM ${response.status}`);
    const raw = await response.json();
    return parseIrmForecast({
      raw,
      latitude: city.latitude,
      longitude: city.longitude,
      distanceKm: 0,
      lang: "en",
      mode: "snapshot",
    });
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchIrmSnapshot() {
  const generatedAt = new Date().toISOString();
  const settled = await Promise.allSettled(IRM_CITIES.map(fetchCity));
  const cities = [];
  for (let index = 0; index < settled.length; index += 1) {
    const result = settled[index];
    if (result.status === "fulfilled" && result.value) {
      cities.push({
        ...IRM_CITIES[index],
        official: { ...result.value, snapshotAt: generatedAt },
      });
    }
  }
  return {
    generatedAt,
    provider: "IRM / KMI",
    cities,
  };
}

async function main() {
  const outIndex = process.argv.indexOf("--out");
  const out =
    outIndex >= 0
      ? path.resolve(process.argv[outIndex + 1])
      : path.resolve("dist/data/irm.json");
  const snapshot = await fetchIrmSnapshot();
  await fs.mkdir(path.dirname(out), { recursive: true });
  await fs.writeFile(out, JSON.stringify(snapshot), "utf8");
  console.log(`IRM snapshot: ${snapshot.cities.length}/${IRM_CITIES.length} Belgian centres → ${out}`);
}

const isCli =
  process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isCli) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
