export type WeatherGroup =
  | "clear"
  | "partly"
  | "cloudy"
  | "fog"
  | "drizzle"
  | "rain"
  | "snow"
  | "thunder";

export type WeatherKey =
  | "clear"
  | "mainlyClear"
  | "partlyCloudy"
  | "overcast"
  | "fog"
  | "drizzle"
  | "freezingDrizzle"
  | "rain"
  | "heavyRain"
  | "freezingRain"
  | "snow"
  | "snowGrains"
  | "rainShowers"
  | "snowShowers"
  | "thunderstorm"
  | "thunderHail";

export interface CodeInfo {
  key: WeatherKey;
  group: WeatherGroup;
  severity: number;
}

const CODES: Record<number, CodeInfo> = {
  0: { key: "clear", group: "clear", severity: 0 },
  1: { key: "mainlyClear", group: "clear", severity: 1 },
  2: { key: "partlyCloudy", group: "partly", severity: 2 },
  3: { key: "overcast", group: "cloudy", severity: 3 },
  45: { key: "fog", group: "fog", severity: 4 },
  48: { key: "fog", group: "fog", severity: 5 },
  51: { key: "drizzle", group: "drizzle", severity: 6 },
  53: { key: "drizzle", group: "drizzle", severity: 7 },
  55: { key: "drizzle", group: "drizzle", severity: 8 },
  56: { key: "freezingDrizzle", group: "drizzle", severity: 9 },
  57: { key: "freezingDrizzle", group: "drizzle", severity: 10 },
  61: { key: "rain", group: "rain", severity: 11 },
  63: { key: "rain", group: "rain", severity: 12 },
  65: { key: "heavyRain", group: "rain", severity: 13 },
  66: { key: "freezingRain", group: "rain", severity: 14 },
  67: { key: "freezingRain", group: "rain", severity: 15 },
  71: { key: "snow", group: "snow", severity: 16 },
  73: { key: "snow", group: "snow", severity: 17 },
  75: { key: "snow", group: "snow", severity: 18 },
  77: { key: "snowGrains", group: "snow", severity: 16 },
  80: { key: "rainShowers", group: "rain", severity: 11 },
  81: { key: "rainShowers", group: "rain", severity: 12 },
  82: { key: "rainShowers", group: "rain", severity: 13 },
  85: { key: "snowShowers", group: "snow", severity: 16 },
  86: { key: "snowShowers", group: "snow", severity: 17 },
  95: { key: "thunderstorm", group: "thunder", severity: 20 },
  96: { key: "thunderHail", group: "thunder", severity: 21 },
  99: { key: "thunderHail", group: "thunder", severity: 22 },
};

export const GROUP_ORDER: WeatherGroup[] = [
  "clear",
  "partly",
  "cloudy",
  "fog",
  "drizzle",
  "rain",
  "snow",
  "thunder",
];

export function codeInfo(code: number | null | undefined): CodeInfo {
  if (code == null || !Number.isFinite(code)) return CODES[3];
  return CODES[code] ?? CODES[3];
}

export function isPrecipitating(code: number | null | undefined): boolean {
  return ["drizzle", "rain", "snow", "thunder"].includes(codeInfo(code).group);
}
