import type { OfficialSource, OfficialWarning } from "../shared/types.ts";

/**
 * IRM/KMI's app API uses its own 0–27 weather-code scale. Translate it to WMO
 * codes so the official source can reuse DFWMeteo's weather glyph system.
 */
export function irmCodeToWmo(value: unknown): number {
  const code = Number(value);
  if (!Number.isFinite(code)) return 3;
  if (code === 0 || code === 1) return 0;
  if (code === 3) return 2;
  if (code === 14 || code === 15) return 3;
  if ([2, 5, 7, 10, 13, 17].includes(code)) return 95;
  if ([4, 6, 16, 19].includes(code)) return 65;
  if ([8, 9, 20].includes(code)) return 66;
  if ([11, 12, 22, 23].includes(code)) return 71;
  if ([18, 21].includes(code)) return 61;
  if ([24, 25, 26, 27].includes(code)) return 45;
  return 3;
}

function numberOrNull(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function localized(value: unknown, lang: string): string {
  if (typeof value === "string") return value;
  if (!value || typeof value !== "object") return "";
  const dict = value as Record<string, unknown>;
  return String(dict[lang] ?? dict.en ?? dict.fr ?? dict.nl ?? "");
}

function parseWarnings(raw: any, lang: string): OfficialWarning[] {
  const source = raw?.for?.warning;
  if (!Array.isArray(source)) return [];
  const result: OfficialWarning[] = [];
  for (const item of source) {
    const start = item?.fromTimestamp ? String(item.fromTimestamp) : "";
    const end = item?.toTimestamp ? String(item.toTimestamp) : "";
    if (!start || !end) continue;
    result.push({
      id: numberOrNull(item?.warningType?.id),
      level: numberOrNull(item?.warningLevel),
      title: localized(item?.warningType?.name, lang),
      text: localized(item?.text, lang),
      startsAt: start,
      endsAt: end,
    });
  }
  return result;
}

/**
 * Parse one IRM `getForecasts` payload into the small official-reference shape
 * used by the client. This does not pretend to be a ninth numerical model; it
 * is the official Belgian nowcast/observation layer shown next to the blend.
 */
export function parseIrmForecast({
  raw,
  latitude,
  longitude,
  distanceKm,
  lang,
  mode,
  snapshotAt,
}: {
  raw: any;
  latitude: number;
  longitude: number;
  distanceKm: number;
  lang: string;
  mode: "live" | "snapshot";
  snapshotAt?: string;
}): OfficialSource | null {
  const obs = raw?.obs;
  const hourly = Array.isArray(raw?.for?.hourly) ? raw.for.hourly[0] : null;
  const obsTemp = numberOrNull(obs?.temp);
  const hourlyTemp = numberOrNull(hourly?.temp);
  const temp = obsTemp ?? hourlyTemp;
  if (temp == null) return null;

  const dailyRaw = Array.isArray(raw?.for?.daily) ? raw.for.daily : [];
  const dayPeriod =
    dailyRaw.find((period: any) => period?.dayNight === "d" && numberOrNull(period?.tempMax) != null) ??
    dailyRaw.find((period: any) => numberOrNull(period?.tempMax) != null) ??
    null;
  const horizon = dailyRaw.slice(0, 4);
  const maxima = horizon
    .map((period: any) => numberOrNull(period?.tempMax))
    .filter((value: number | null): value is number => value != null);
  const minima = horizon
    .map((period: any) => numberOrNull(period?.tempMin))
    .filter((value: number | null): value is number => value != null);
  const daily =
    dayPeriod == null && !maxima.length && !minima.length
      ? null
      : {
          max: maxima.length ? Math.max(...maxima) : null,
          min: minima.length ? Math.min(...minima) : null,
          code: irmCodeToWmo(dayPeriod?.ww1 ?? dayPeriod?.ww2),
          precipitationProbability: numberOrNull(dayPeriod?.precipChance),
        };

  const direction = numberOrNull(hourly?.windDirection);
  const isDay = (obs?.dayNight ?? hourly?.dayNight) === "d";
  const updatedAt =
    (obs?.timestamp ? String(obs.timestamp) : null) ??
    (snapshotAt ? String(snapshotAt) : new Date().toISOString());

  return {
    provider: "IRM / KMI",
    name: String(raw?.cityName ?? "Belgium"),
    latitude,
    longitude,
    distanceKm: Math.round(distanceKm * 10) / 10,
    updatedAt,
    snapshotAt,
    mode,
    current: {
      temp,
      code: irmCodeToWmo(obs?.ww ?? hourly?.ww),
      isDay,
      windSpeed: numberOrNull(hourly?.windSpeedKm),
      windGust: numberOrNull(hourly?.windPeakSpeedKm),
      windDirection:
        direction == null || hourly?.windDirectionText?.en === "VAR"
          ? null
          : (direction + 180) % 360,
      precipitation: numberOrNull(hourly?.precipQuantity),
      precipitationProbability: numberOrNull(hourly?.precipChance),
      pressure: numberOrNull(hourly?.pressure),
    },
    daily,
    warnings: parseWarnings(raw, lang),
  };
}
