import type { SourceInfo } from "../shared/types.ts";

export interface ModelDefinition extends SourceInfo {
  apiId: string;
}

export const MODELS: ModelDefinition[] = [
  {
    id: "ecmwf",
    apiId: "ecmwf_ifs025",
    name: "ECMWF IFS",
    shortName: "IFS",
    center: "ECMWF",
    description: "The European Centre's flagship global model.",
    resolution: "0.25° global",
    color: "#8db9ff",
    region: "europe",
  },
  {
    id: "icon",
    apiId: "icon_seamless",
    name: "ICON",
    shortName: "ICON",
    center: "DWD",
    description: "Germany's seamless global and 2 km European model.",
    resolution: "2–11 km",
    color: "#8fe3cf",
    region: "europe",
  },
  {
    id: "ukmo",
    apiId: "ukmo_seamless",
    name: "UK Met Office",
    shortName: "UKMO",
    center: "Met Office",
    description: "Global model blended with high-resolution UK data.",
    resolution: "2–10 km",
    color: "#c9b6ff",
    region: "europe",
  },
  {
    id: "meteofrance",
    apiId: "meteofrance_seamless",
    name: "Météo-France",
    shortName: "MF",
    center: "Météo-France",
    description: "ARPEGE global paired with the 1.3 km AROME core.",
    resolution: "1.3–25 km",
    color: "#ffad9e",
    region: "europe",
  },
  {
    id: "gfs",
    apiId: "gfs_seamless",
    name: "GFS",
    shortName: "GFS",
    center: "NOAA",
    description: "America's global model, blended with HRRR over the US.",
    resolution: "3–13 km",
    color: "#f2c879",
    region: "north-america",
  },
  {
    id: "gem",
    apiId: "gem_seamless",
    name: "GEM",
    shortName: "GEM",
    center: "ECCC",
    description: "Canada's global model and high-resolution regional core.",
    resolution: "2.5–10 km",
    color: "#7fd6f4",
    region: "north-america",
  },
  {
    id: "jma",
    apiId: "jma_seamless",
    name: "JMA GSM",
    shortName: "JMA",
    center: "JMA",
    description: "Japan's global spectral model with regional MSM.",
    resolution: "5–20 km",
    color: "#dbe4f5",
    region: "asia",
  },
  {
    id: "cma",
    apiId: "cma_grapes_global",
    name: "CMA GRAPES",
    shortName: "CMA",
    center: "CMA",
    description: "China's global GRAPES forecast system.",
    resolution: "0.25° global",
    color: "#b7d08d",
    region: "asia",
  },
];

type WeightProfile = Record<string, number>;

const BELGIUM: WeightProfile = {
  ecmwf: 1.55,
  icon: 1.34,
  ukmo: 1.24,
  meteofrance: 1.16,
  gfs: 0.96,
  gem: 0.9,
  jma: 0.72,
  cma: 0.64,
};

const EUROPE: WeightProfile = {
  ecmwf: 1.5,
  icon: 1.28,
  ukmo: 1.16,
  meteofrance: 1.08,
  gfs: 0.96,
  gem: 0.9,
  jma: 0.72,
  cma: 0.66,
};

const NORTH_AMERICA: WeightProfile = {
  gfs: 1.48,
  gem: 1.28,
  ecmwf: 1.38,
  icon: 0.95,
  ukmo: 0.9,
  meteofrance: 0.76,
  jma: 0.7,
  cma: 0.58,
};

const ASIA: WeightProfile = {
  ecmwf: 1.4,
  jma: 1.28,
  cma: 1.14,
  gfs: 0.92,
  icon: 0.88,
  ukmo: 0.82,
  gem: 0.76,
  meteofrance: 0.64,
};

const GLOBAL: WeightProfile = {
  ecmwf: 1.42,
  gfs: 1.12,
  icon: 1.1,
  ukmo: 1.02,
  meteofrance: 0.94,
  gem: 0.94,
  jma: 0.9,
  cma: 0.66,
};

const EUROPE_BORDER = new Set(["NL", "LU", "FR", "DE", "GB", "IE", "CH", "AT", "DK"]);
const NORTH_AMERICA_CODES = new Set(["US", "CA", "MX", "GL"]);
const ASIA_CODES = new Set([
  "JP",
  "CN",
  "KR",
  "KP",
  "IN",
  "PK",
  "BD",
  "LK",
  "NP",
  "BT",
  "MM",
  "TH",
  "VN",
  "LA",
  "KH",
  "MY",
  "SG",
  "ID",
  "PH",
  "TW",
  "HK",
  "MO",
  "MN",
  "KZ",
  "UZ",
  "TM",
  "KG",
  "TJ",
  "AF",
  "IR",
  "IQ",
  "IL",
  "JO",
  "SA",
  "AE",
  "QA",
  "OM",
  "KW",
  "BH",
  "YE",
  "TR",
  "GE",
  "AM",
  "AZ",
]);

export function weightProfile(countryCode: string): WeightProfile {
  const code = countryCode.toUpperCase();
  if (code === "BE") return BELGIUM;
  if (EUROPE_BORDER.has(code)) return EUROPE;
  if (NORTH_AMERICA_CODES.has(code)) return NORTH_AMERICA;
  if (ASIA_CODES.has(code)) return ASIA;
  return GLOBAL;
}

export function normaliseWeights(
  entries: { id: string; priorWeight: number }[],
): { id: string; influence: number }[] {
  const total = entries.reduce((sum, entry) => sum + entry.priorWeight, 0) || 1;
  return entries.map((entry) => ({
    id: entry.id,
    influence: entry.priorWeight / total,
  }));
}
