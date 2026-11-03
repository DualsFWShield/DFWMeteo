export const LOCALE_TAGS = {
  en: "en-GB",
  fr: "fr-BE",
  nl: "nl-BE",
};

export const WMO = {
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

export const PRECIP_GROUPS = new Set(["drizzle", "rain", "snow", "thunder"]);

export function weatherInfo(code) {
  return WMO[code] ?? WMO[3];
}

export function weatherGroup(code) {
  return weatherInfo(code).group;
}

export function weatherKey(code) {
  return weatherInfo(code).key;
}

export function tempValue(celsius, units) {
  if (celsius == null || Number.isNaN(Number(celsius))) return null;
  return units === "imperial" ? (Number(celsius) * 9) / 5 + 32 : Number(celsius);
}

export function formatTemp(celsius, units, locale = "en", digits = 0) {
  let value = tempValue(celsius, units);
  if (value == null) return "—";
  if (Math.abs(value) < 0.5 && digits === 0) value = 0;
  return `${formatNumber(value, locale, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })}°`;
}

export function formatTempValue(celsius, units, locale = "en", digits = 0) {
  let value = tempValue(celsius, units);
  if (value == null) return "—";
  if (Math.abs(value) < 0.5 && digits === 0) value = 0;
  return formatNumber(value, locale, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

export function formatTempUnit(units) {
  return units === "imperial" ? "°F" : "°C";
}

export function formatWind(kmh, units, locale = "en", digits = 0) {
  if (kmh == null || Number.isNaN(Number(kmh))) return "—";
  const value = units === "imperial" ? Number(kmh) * 0.621371 : Number(kmh);
  return `${formatNumber(value, locale, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })} ${units === "imperial" ? "mph" : "km/h"}`;
}

export function formatWindValue(kmh, units, locale = "en", digits = 0) {
  if (kmh == null || Number.isNaN(Number(kmh))) return "—";
  const value = units === "imperial" ? Number(kmh) * 0.621371 : Number(kmh);
  return formatNumber(value, locale, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

export function formatPrecip(mm, units, locale = "en", digits = 1) {
  if (mm == null || Number.isNaN(Number(mm))) return "—";
  const value = units === "imperial" ? Number(mm) / 25.4 : Number(mm);
  const actualDigits = units === "imperial" ? Math.max(2, digits) : digits;
  return `${formatNumber(value, locale, {
    minimumFractionDigits: value > 0 && value < 0.1 ? actualDigits : 0,
    maximumFractionDigits: actualDigits,
  })} ${units === "imperial" ? "in" : "mm"}`;
}

export function formatPrecipValue(mm, units, locale = "en", digits = 1) {
  if (mm == null || Number.isNaN(Number(mm))) return "—";
  const value = units === "imperial" ? Number(mm) / 25.4 : Number(mm);
  return formatNumber(value, locale, {
    minimumFractionDigits: 0,
    maximumFractionDigits: units === "imperial" ? Math.max(2, digits) : digits,
  });
}

export function formatPressure(hpa, units, locale = "en") {
  if (hpa == null || Number.isNaN(Number(hpa))) return "—";
  if (units === "imperial") {
    return `${formatNumber(Number(hpa) * 0.0295299830714, locale, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })} inHg`;
  }
  return `${formatNumber(Number(hpa), locale, {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })} hPa`;
}

export function formatVisibility(km, units, locale = "en") {
  if (km == null || Number.isNaN(Number(km))) return "—";
  const value = units === "imperial" ? Number(km) * 0.621371 : Number(km);
  return `${formatNumber(value, locale, {
    maximumFractionDigits: value >= 10 ? 0 : 1,
  })} ${units === "imperial" ? "mi" : "km"}`;
}

export function formatDistanceValue(km, units, locale = "en") {
  if (km == null || Number.isNaN(Number(km))) return "—";
  const value = units === "imperial" ? Number(km) * 0.621371 : Number(km);
  return formatNumber(value, locale, {
    maximumFractionDigits: value >= 10 ? 0 : 1,
  });
}

export function formatNumber(value, locale = "en", options = {}) {
  return new Intl.NumberFormat(LOCALE_TAGS[locale] ?? LOCALE_TAGS.en, options).format(
    Number(value),
  );
}

export function formatPercent(value, locale = "en") {
  if (value == null || Number.isNaN(Number(value))) return "—";
  return `${formatNumber(Math.round(value), locale, { maximumFractionDigits: 0 })}%`;
}

export function formatDateLong(date, locale = "en", timeZone = "UTC") {
  const value = date instanceof Date ? date : dateOnly(date);
  return new Intl.DateTimeFormat(LOCALE_TAGS[locale] ?? LOCALE_TAGS.en, {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone,
  }).format(value);
}

export function formatDateShort(date, locale = "en") {
  const value = date instanceof Date ? date : dateOnly(date);
  return new Intl.DateTimeFormat(LOCALE_TAGS[locale] ?? LOCALE_TAGS.en, {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  }).format(value);
}

export function formatWeekdayShort(date, locale = "en") {
  const value = dateOnly(date);
  return new Intl.DateTimeFormat(LOCALE_TAGS[locale] ?? LOCALE_TAGS.en, {
    weekday: "short",
    timeZone: "UTC",
  }).format(value);
}

export function formatMonthDay(date, locale = "en") {
  const value = dateOnly(date);
  return new Intl.DateTimeFormat(LOCALE_TAGS[locale] ?? LOCALE_TAGS.en, {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  }).format(value);
}

export function formatDateNumeric(date, locale = "en") {
  const value = date instanceof Date ? date : dateOnly(date);
  return new Intl.DateTimeFormat(LOCALE_TAGS[locale] ?? LOCALE_TAGS.en, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "UTC",
  }).format(value);
}

function dateOnly(date) {
  if (date instanceof Date) return date;
  const text = String(date);
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return new Date(`${text}T12:00:00Z`);
  return new Date(text);
}

export function formatHour(iso, locale = "en") {
  if (!iso) return "—";
  const match = String(iso).match(/T(\d{2}):(\d{2})/);
  if (!match) return "—";
  return `${match[1]}:${match[2]}`;
}

export function formatTime(iso) {
  return formatHour(iso);
}

export function formatDaylight(seconds, locale = "en") {
  if (seconds == null || Number.isNaN(Number(seconds))) return "—";
  const totalMinutes = Math.round(Number(seconds) / 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  const tag = LOCALE_TAGS[locale] ?? LOCALE_TAGS.en;
  const hourLabel = new Intl.NumberFormat(tag, { maximumFractionDigits: 0 }).format(hours);
  const minuteLabel = String(minutes).padStart(2, "0");
  if (locale === "fr") return `${hourLabel} h ${minuteLabel}`;
  if (locale === "nl") return `${hourLabel} u ${minuteLabel}`;
  return `${hourLabel}h ${minuteLabel}m`;
}

const COMPASS = {
  en: ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"],
  fr: ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSO", "SO", "OSO", "O", "ONO", "NO", "NNO"],
  nl: ["N", "NNO", "NO", "ONO", "O", "OZO", "ZO", "ZZO", "Z", "ZZW", "ZW", "WZW", "W", "WNW", "NW", "NNW"],
};

export function compassPoint(degrees, locale = "en") {
  if (degrees == null || Number.isNaN(Number(degrees))) return "—";
  const index = Math.round((((Number(degrees) % 360) + 360) % 360) / 22.5) % 16;
  return (COMPASS[locale] ?? COMPASS.en)[index];
}

export function relativeTimeParts(iso, now = Date.now()) {
  const timestamp = Date.parse(iso);
  if (!Number.isFinite(timestamp)) return { value: 0, unit: "minute" };
  const seconds = Math.max(0, Math.round((now - timestamp) / 1000));
  if (seconds < 45) return { value: 0, unit: "now" };
  if (seconds < 3600) return { value: Math.max(1, Math.round(seconds / 60)), unit: "minute" };
  if (seconds < 86400) return { value: Math.round(seconds / 3600), unit: "hour" };
  return { value: Math.round(seconds / 86400), unit: "day" };
}

export function uvCategory(value) {
  if (value == null) return "low";
  if (value < 3) return "low";
  if (value < 6) return "moderate";
  if (value < 8) return "high";
  if (value < 11) return "veryHigh";
  return "extreme";
}

export function aqiColor(level) {
  return (
    {
      good: "#78d6a0",
      fair: "#b6df7c",
      moderate: "#f1cd6d",
      poor: "#f0a063",
      "very-poor": "#e97070",
      extreme: "#b47ad6",
    }[level] ?? "#b6df7c"
  );
}

export function aqiKey(level) {
  return (
    {
      good: "good",
      fair: "fair",
      moderate: "moderate",
      poor: "poor",
      "very-poor": "veryPoor",
      extreme: "extreme",
    }[level] ?? "fair"
  );
}

export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export function percentile(values, fraction) {
  const valid = values.filter((value) => value != null && Number.isFinite(value)).sort((a, b) => a - b);
  if (!valid.length) return null;
  const index = clamp(fraction, 0, 1) * (valid.length - 1);
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) return valid[lower];
  return valid[lower] + (valid[upper] - valid[lower]) * (index - lower);
}

export function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function countryCodeLabel(code) {
  return String(code || "").toUpperCase().slice(0, 2) || "··";
}

export function formatCoordinates(latitude, longitude) {
  const lat = `${Math.abs(latitude).toFixed(2)}°${latitude >= 0 ? "N" : "S"}`;
  const lon = `${Math.abs(longitude).toFixed(2)}°${longitude >= 0 ? "E" : "W"}`;
  return `${lat}, ${lon}`;
}

export function moonPhaseKey(nameKey) {
  return nameKey || "new";
}

export function pressureTrend(hourly) {
  if (!Array.isArray(hourly) || hourly.length < 4) return "steady";
  const current = hourly[0]?.pressure;
  const before = hourly[3]?.pressure;
  if (current == null || before == null) return "steady";
  const delta = current - before;
  if (delta > 1.4) return "rising";
  if (delta < -1.4) return "falling";
  return "steady";
}

export function formatSigned(value, digits = 1) {
  if (value == null || Number.isNaN(Number(value))) return "—";
  const rounded = Number(value).toFixed(digits);
  return Number(value) > 0 ? `+${rounded}` : rounded;
}
