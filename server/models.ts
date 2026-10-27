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
  {
    id: "knmi",
    apiId: "knmi_seamless",
    name: "KNMI",
    shortName: "KNMI",
    center: "KNMI",
    description: "Netherlands Royal Met Institute 2.5 km HARMONIE model over Benelux.",
    resolution: "2.5 km Benelux",
    color: "#fb923c",
    region: "europe",
  },
  {
    id: "metno",
    apiId: "metno_seamless",
    name: "MET Norway",
    shortName: "MET",
    center: "MET Norway",
    description: "Nordic and European high-resolution forecast model.",
    resolution: "1–2.5 km",
    color: "#38bdf8",
    region: "europe",
  },
  {
    id: "dmi",
    apiId: "dmi_seamless",
    name: "DMI",
    shortName: "DMI",
    center: "DMI",
    description: "Danish Meteorological Institute regional and coastal model.",
    resolution: "2.5 km Europe",
    color: "#a78bfa",
    region: "europe",
  },
  {
    id: "bom",
    apiId: "bom_access_global",
    name: "BOM ACCESS-G",
    shortName: "BOM",
    center: "BOM",
    description: "Australian Bureau of Meteorology global numerical prediction.",
    resolution: "12 km global",
    color: "#34d399",
    region: "global",
  },
];

type WeightProfile = Record<string, number>;

const BELGIUM: WeightProfile = {
  ecmwf: 1.45,
  knmi: 1.40,
  icon: 1.25,
  ukmo: 1.15,
  meteofrance: 1.10,
  metno: 1.05,
  dmi: 0.95,
  gfs: 0.85,
  gem: 0.80,
  bom: 0.70,
  jma: 0.65,
  cma: 0.55,
};

const EUROPE: WeightProfile = {
  ecmwf: 1.45,
  icon: 1.25,
  knmi: 1.15,
  metno: 1.15,
  ukmo: 1.12,
  meteofrance: 1.08,
  dmi: 1.00,
  gfs: 0.88,
  gem: 0.82,
  bom: 0.70,
  jma: 0.65,
  cma: 0.55,
};

const NORTH_AMERICA: WeightProfile = {
  gfs: 1.45,
  gem: 1.25,
  ecmwf: 1.35,
  bom: 0.95,
  icon: 0.90,
  ukmo: 0.85,
  metno: 0.75,
  meteofrance: 0.70,
  jma: 0.65,
  cma: 0.55,
  knmi: 0.50,
  dmi: 0.50,
};

const ASIA: WeightProfile = {
  ecmwf: 1.35,
  jma: 1.25,
  cma: 1.15,
  bom: 1.00,
  gfs: 0.90,
  icon: 0.85,
  ukmo: 0.80,
  gem: 0.75,
  metno: 0.65,
  meteofrance: 0.60,
  knmi: 0.50,
  dmi: 0.50,
};

const GLOBAL: WeightProfile = {
  ecmwf: 1.35,
  gfs: 1.10,
  icon: 1.05,
  bom: 1.00,
  ukmo: 0.98,
  gem: 0.92,
  metno: 0.88,
  meteofrance: 0.88,
  knmi: 0.80,
  dmi: 0.80,
  jma: 0.85,
  cma: 0.65,
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
