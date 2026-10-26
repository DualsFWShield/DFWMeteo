import {
  fetchWeather,
  placeFromUrl,
  placeKey,
  reversePlace,
  searchPlaces,
  writePlaceToUrl,
} from "./api.js";
import {
  aqiBar,
  aqiSparkline,
  cloudDonut,
  humidityDrop,
  modelSpreadChart,
  nowcastBars,
  precipBars,
  pressureGauge,
  sunArc,
  uvArc,
  visibilityBar,
  windCompass,
} from "./charts.js";
import {
  LOCALE_TAGS,
  aqiColor,
  aqiKey,
  clamp,
  compassPoint,
  escapeHtml,
  formatDateLong,
  formatDateShort,
  formatDaylight,
  formatHour,
  formatMonthDay,
  formatNumber,
  formatPercent,
  formatPrecip,
  formatPressure,
  formatTemp,
  formatTempValue,
  formatVisibility,
  formatWeekdayShort,
  formatWind,
  formatWindValue,
  pressureTrend,
  relativeTimeParts,
  tempValue,
  uvCategory,
  weatherGroup,
  weatherKey,
} from "./format.js";
import { t } from "./i18n.js";
import {
  advisoryIcon,
  agreementRing,
  brandMark,
  modelGlyph,
  moonIcon,
  uiIcon,
  weatherGlyph,
} from "./icons.js";

const DEFAULT_PLACE = {
  name: "Brussels",
  country: "Belgium",
  countryCode: "BE",
  admin1: "Brussels-Capital",
  latitude: 50.8503,
  longitude: 4.3517,
};

const BELGIAN_CITIES = [
  { names: { en: "Brussels", fr: "Bruxelles", nl: "Brussel" }, latitude: 50.8503, longitude: 4.3517, admin1: "Brussels-Capital" },
  { names: { en: "Antwerp", fr: "Anvers", nl: "Antwerpen" }, latitude: 51.2194, longitude: 4.4025, admin1: "Flanders" },
  { names: { en: "Ghent", fr: "Gand", nl: "Gent" }, latitude: 51.0543, longitude: 3.7174, admin1: "Flanders" },
  { names: { en: "Liège", fr: "Liège", nl: "Luik" }, latitude: 50.6326, longitude: 5.5797, admin1: "Wallonia" },
  { names: { en: "Bruges", fr: "Bruges", nl: "Brugge" }, latitude: 51.2093, longitude: 3.2247, admin1: "Flanders" },
  { names: { en: "Namur", fr: "Namur", nl: "Namen" }, latitude: 50.4674, longitude: 4.8718, admin1: "Wallonia" },
  { names: { en: "Leuven", fr: "Louvain", nl: "Leuven" }, latitude: 50.8798, longitude: 4.7005, admin1: "Flanders" },
  { names: { en: "Charleroi", fr: "Charleroi", nl: "Charleroi" }, latitude: 50.4114, longitude: 4.4445, admin1: "Wallonia" },
  { names: { en: "Mechelen", fr: "Malines", nl: "Mechelen" }, latitude: 51.0259, longitude: 4.4776, admin1: "Flanders" },
  { names: { en: "Hasselt", fr: "Hasselt", nl: "Hasselt" }, latitude: 50.9307, longitude: 5.3378, admin1: "Flanders" },
  { names: { en: "Kortrijk", fr: "Courtrai", nl: "Kortrijk" }, latitude: 50.828, longitude: 3.2649, admin1: "Flanders" },
  { names: { en: "Ostend", fr: "Ostende", nl: "Oostende" }, latitude: 51.2154, longitude: 2.9287, admin1: "Flanders" },
];

const GLOBAL_CITIES = [
  { names: { en: "Paris", fr: "Paris", nl: "Parijs" }, country: "France", countryCode: "FR", admin1: "Île-de-France", latitude: 48.8566, longitude: 2.3522 },
  { names: { en: "Amsterdam", fr: "Amsterdam", nl: "Amsterdam" }, country: "Netherlands", countryCode: "NL", admin1: "North Holland", latitude: 52.3676, longitude: 4.9041 },
  { names: { en: "London", fr: "Londres", nl: "Londen" }, country: "United Kingdom", countryCode: "GB", admin1: "England", latitude: 51.5072, longitude: -0.1276 },
  { names: { en: "Berlin", fr: "Berlin", nl: "Berlijn" }, country: "Germany", countryCode: "DE", admin1: "Berlin", latitude: 52.52, longitude: 13.405 },
  { names: { en: "New York", fr: "New York", nl: "New York" }, country: "United States", countryCode: "US", admin1: "New York", latitude: 40.7128, longitude: -74.006 },
  { names: { en: "Tokyo", fr: "Tokyo", nl: "Tokio" }, country: "Japan", countryCode: "JP", admin1: "Tokyo", latitude: 35.6762, longitude: 139.6503 },
];

const STORAGE = {
  prefs: "dfwmeteo:prefs:v1",
  lastPlace: "dfwmeteo:last-place:v1",
  favorites: "dfwmeteo:favorites:v1",
  weatherPrefix: "dfwmeteo:weather:v1:",
};

const app = document.querySelector("#app");
const modalRoot = document.querySelector("#modal-root");
const toastRoot = document.querySelector("#toast-root");
const isMac = /Mac|iPhone|iPad|iPod/.test(navigator.platform);
const SHORTCUT = isMac ? "⌘K" : "Ctrl K";

const state = {
  place: { ...DEFAULT_PLACE },
  weather: null,
  status: "booting",
  error: null,
  cached: false,
  refreshing: false,
  units: "metric",
  locale: "en",
  motion: "full",
  favorites: [],
  hourlyView: "overview",
  hourlyMetric: "temp",
  briefExpanded: false,
  modal: null,
  modalTrigger: null,
  search: {
    query: "",
    results: [],
    loading: false,
    error: null,
    items: [],
    activeIndex: 0,
    controller: null,
    timer: null,
    locating: false,
  },
  requestSeq: 0,
  controller: null,
  lastFetchAt: 0,
  lastRenderedMinute: null,
};

function tr(key, vars = {}) {
  return t(state.locale, key, vars);
}

/* ------------------------------------------------------------------ */
/* Storage                                                             */
/* ------------------------------------------------------------------ */

function readStorage(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw == null ? fallback : JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function writeStorage(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* Storage can be unavailable in private modes. */
  }
}

function loadPreferences() {
  const reduceMotion =
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const prefs = readStorage(STORAGE.prefs, {});
  const urlLanguage = new URLSearchParams(window.location.search).get("lang");
  state.locale = ["en", "fr", "nl"].includes(prefs.locale)
    ? prefs.locale
    : ["en", "fr", "nl"].includes(urlLanguage)
      ? urlLanguage
      : "en";
  state.units = prefs.units === "imperial" ? "imperial" : "metric";
  state.motion =
    prefs.motion === "reduced" || prefs.motion === "full"
      ? prefs.motion
      : reduceMotion
        ? "reduced"
        : "full";
  state.favorites = Array.isArray(readStorage(STORAGE.favorites, []))
    ? readStorage(STORAGE.favorites, []).filter(isValidPlace)
    : [];
  applyPreferences();
}

function savePreferences() {
  writeStorage(STORAGE.prefs, {
    units: state.units,
    locale: state.locale,
    motion: state.motion,
  });
}

function applyPreferences() {
  document.documentElement.lang = state.locale;
  document.documentElement.classList.toggle("reduce-motion", state.motion === "reduced");
}

function loadLastPlace() {
  const stored = readStorage(STORAGE.lastPlace, null);
  return isValidPlace(stored) ? stored : null;
}

function saveLastPlace(place) {
  writeStorage(STORAGE.lastPlace, place);
}

function saveFavorites() {
  writeStorage(STORAGE.favorites, state.favorites);
}

function cacheKey(place) {
  return `${STORAGE.weatherPrefix}${placeKey(place)}`;
}

function loadWeatherCache(place) {
  const entry = readStorage(cacheKey(place), null);
  if (!entry?.payload || !Array.isArray(entry.payload.hourly)) return null;
  if (Date.now() - Number(entry.savedAt || 0) > 1000 * 60 * 60 * 36) return null;
  return entry.payload;
}

function saveWeatherCache(place, payload) {
  writeStorage(cacheKey(place), {
    savedAt: Date.now(),
    payload,
  });
  pruneWeatherCache();
}

function pruneWeatherCache() {
  try {
    const keys = Object.keys(localStorage).filter((key) => key.startsWith(STORAGE.weatherPrefix));
    if (keys.length <= 8) return;
    const entries = keys
      .map((key) => {
        const parsed = readStorage(key, null);
        return { key, savedAt: Number(parsed?.savedAt || 0) };
      })
      .sort((a, b) => a.savedAt - b.savedAt);
    for (const entry of entries.slice(0, entries.length - 8)) {
      localStorage.removeItem(entry.key);
    }
  } catch {
    /* best effort */
  }
}

/* ------------------------------------------------------------------ */
/* Places & helpers                                                    */
/* ------------------------------------------------------------------ */

function isValidPlace(place) {
  return Boolean(
    place &&
      Number.isFinite(Number(place.latitude)) &&
      Number.isFinite(Number(place.longitude)) &&
      typeof place.name === "string",
  );
}

function normalisePlace(place) {
  return {
    ...place,
    name: String(place.name || "Selected location").slice(0, 120),
    country: String(place.country || ""),
    countryCode: String(place.countryCode || "").toUpperCase().slice(0, 3),
    latitude: Number(place.latitude),
    longitude: Number(place.longitude),
    admin1: place.admin1 || undefined,
  };
}

function presetForPlace(place) {
  const all = [...BELGIAN_CITIES, ...GLOBAL_CITIES];
  return (
    all.find(
      (city) =>
        Math.abs(Number(city.latitude) - Number(place.latitude)) < 0.025 &&
        Math.abs(Number(city.longitude) - Number(place.longitude)) < 0.025 &&
        (!city.countryCode || city.countryCode === place.countryCode),
    ) || null
  );
}

function displayName(place) {
  const preset = presetForPlace(place);
  return preset?.names?.[state.locale] || place.name;
}

function presetPlace(city) {
  return normalisePlace({
    name: city.names[state.locale] || city.names.en,
    country: city.country || "Belgium",
    countryCode: city.countryCode || "BE",
    admin1: city.admin1,
    latitude: city.latitude,
    longitude: city.longitude,
  });
}

function countryLabel(place) {
  if (!place?.countryCode) return place?.country || "";
  try {
    return (
      new Intl.DisplayNames([LOCALE_TAGS[state.locale] || "en-GB"], { type: "region" }).of(
        place.countryCode,
      ) || place.country
    );
  } catch {
    return place.country || place.countryCode;
  }
}

function isSamePlace(a, b) {
  return Boolean(a && b && placeKey(a) === placeKey(b));
}

function isFavorite(place) {
  return state.favorites.some((favorite) => isSamePlace(favorite, place));
}

function placeLocationLabel(place) {
  const country = countryLabel(place);
  const admin = place.admin1 && place.admin1 !== place.name ? place.admin1 : "";
  return admin ? `${admin} · ${country}` : country;
}

function safeTimezone(weather) {
  return weather?.meta?.timezone && weather.meta.timezone !== "auto"
    ? weather.meta.timezone
    : undefined;
}

function localTimeParts(weather) {
  const timeZone = safeTimezone(weather);
  try {
    const formatted = new Intl.DateTimeFormat("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
      timeZone,
    }).format(new Date());
    const [hour, minute] = formatted.split(":");
    return { hour: hour === "24" ? "00" : hour, minute, minutes: Number(hour) * 60 + Number(minute) };
  } catch {
    const now = new Date();
    return {
      hour: String(now.getHours()).padStart(2, "0"),
      minute: String(now.getMinutes()).padStart(2, "0"),
      minutes: now.getHours() * 60 + now.getMinutes(),
    };
  }
}

function localClock(weather) {
  const parts = localTimeParts(weather);
  return `${parts.hour}:${parts.minute}`;
}

function localDateLabel(weather) {
  try {
    return new Intl.DateTimeFormat(LOCALE_TAGS[state.locale] || "en-GB", {
      weekday: "long",
      day: "numeric",
      month: "long",
      timeZone: safeTimezone(weather),
    }).format(new Date());
  } catch {
    return formatDateLong(new Date(), state.locale);
  }
}

function relativeUpdated(weather) {
  const parts = relativeTimeParts(weather.meta.generatedAt);
  if (parts.unit === "now") return tr("common.justNow");
  const unitKey = `${parts.unit}sAgo`;
  return tr(`common.${unitKey}`, { n: parts.value });
}

function updatedLabel(weather) {
  const relative = relativeUpdated(weather);
  if (state.cached) return `${tr("common.cached")} · ${relative}`;
  return tr("hero.updated", { time: relative });
}

function modeLabel() {
  return state.cached ? tr("common.cached") : tr("common.live");
}

function confidenceLevel(score) {
  if (score >= 82) return "High";
  if (score >= 68) return "Moderate";
  return "Low";
}

function confidenceClass(score) {
  if (score >= 82) return "high";
  if (score >= 68) return "moderate";
  return "low";
}

function confidenceColor(score) {
  if (score >= 82) return "#bfe9db";
  if (score >= 68) return "#f2d18a";
  return "#f0a08a";
}

function localeNumber(value, digits = 1, locale = state.locale) {
  return formatNumber(value, locale, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

function formatDelta(celsius, units = state.units, locale = state.locale, digits = 1) {
  if (celsius == null || Number.isNaN(Number(celsius))) return "—";
  const value = units === "imperial" ? (Number(celsius) * 9) / 5 : Number(celsius);
  const rounded = Number(value.toFixed(digits));
  if (Math.abs(rounded) < 0.05) return `0°`;
  return `${rounded > 0 ? "+" : "−"}${localeNumber(Math.abs(rounded), digits, locale)}°`;
}

function formatAbsDelta(celsius, units = state.units, locale = state.locale, digits = 1) {
  if (celsius == null || Number.isNaN(Number(celsius))) return "—";
  const value = units === "imperial" ? (Number(celsius) * 9) / 5 : Number(celsius);
  return `${formatNumber(Math.abs(value), locale, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })}°`;
}

function weightRegionLabel() {
  const code = state.place.countryCode;
  if (code === "BE") return tr("method.priorBelgium");
  if (["US", "CA", "MX", "GL"].includes(code)) return tr("method.priorNorthAmerica");
  if (["FR", "NL", "LU", "DE", "GB", "IE", "CH", "AT", "DK"].includes(code)) {
    return tr("method.priorEurope");
  }
  if (
    [
      "JP",
      "CN",
      "KR",
      "IN",
      "PK",
      "BD",
      "TH",
      "VN",
      "SG",
      "ID",
      "PH",
      "TW",
      "HK",
      "MY",
      "SA",
      "AE",
      "IL",
      "TR",
    ].includes(code)
  ) {
    return tr("method.priorAsia");
  }
  return tr("method.priorGlobal");
}

function localTimeFromIso(iso, weather) {
  if (!iso) return "—";
  try {
    return new Intl.DateTimeFormat(LOCALE_TAGS[state.locale] || "en-GB", {
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
      timeZone: safeTimezone(weather),
    }).format(new Date(iso));
  } catch {
    return formatHour(String(iso).includes("T") ? iso : "");
  }
}

function niceAxisStep(rawStep) {
  if (!Number.isFinite(rawStep) || rawStep <= 0) return 1;
  const exponent = Math.floor(Math.log10(rawStep));
  const fraction = rawStep / 10 ** exponent;
  const nice = fraction <= 1 ? 1 : fraction <= 2 ? 2 : fraction <= 5 ? 5 : 10;
  return nice * 10 ** exponent;
}

function signedNumber(value, digits = 1) {
  if (value == null || Number.isNaN(Number(value))) return "—";
  const rounded = Number(value.toFixed(digits));
  if (Math.abs(rounded) < 0.05) return "0";
  return `${rounded > 0 ? "+" : "−"}${Math.abs(rounded).toFixed(digits)}`;
}

function temperatureUnit() {
  return state.units === "imperial" ? "°F" : "°C";
}

function windUnit() {
  return state.units === "imperial" ? "mph" : "km/h";
}

function currentCondition(weather) {
  return tr(`wx.${weatherKey(weather.current.code)}`);
}

function dayCondition(day) {
  return tr(`wx.${weatherKey(day.code)}`);
}

function conditionTone(group) {
  if (group === "clear") return "clear";
  if (group === "rain" || group === "drizzle" || group === "thunder") return "rain";
  if (group === "snow") return "snow";
  if (group === "fog") return "fog";
  if (group === "partly") return "partly";
  return "cloudy";
}

function dayName(date, index) {
  if (index === 0) return tr("common.today");
  if (index === 1) return tr("common.tomorrow");
  return formatWeekdayShort(date, state.locale);
}

function durationShort(seconds) {
  return formatDaylight(seconds, state.locale);
}

function clockToMinutes(iso) {
  const match = String(iso || "").match(/T(\d{2}):(\d{2})/);
  return match ? Number(match[1]) * 60 + Number(match[2]) : null;
}

function formatDurationFromNow(nowMinutes, targetMinutes) {
  let minutes = targetMinutes - nowMinutes;
  if (minutes <= 0) minutes += 1440;
  return durationShort(minutes * 60);
}

function weatherMode(weather) {
  return state.cached || weather.meta.mode === "cache" ? "cached" : "live";
}

function sourceCount(weather) {
  return weather.sources?.filter((source) => source.available).length || weather.meta.modelCount || 0;
}

function activeSources(weather) {
  return (weather.sources || [])
    .filter((source) => source.available)
    .sort((a, b) => b.influence - a.influence);
}

function average(values) {
  const valid = values.filter((value) => value != null && Number.isFinite(value));
  return valid.length ? valid.reduce((sum, value) => sum + value, 0) / valid.length : null;
}

function maxBy(values, accessor) {
  return values.reduce((best, item) => {
    if (!best) return item;
    return (accessor(item) ?? -Infinity) > (accessor(best) ?? -Infinity) ? item : best;
  }, null);
}

function formatPlaceCoords(place) {
  const lat = `${localeNumber(Math.abs(place.latitude), 2)}°${place.latitude >= 0 ? "N" : "S"}`;
  const lon = `${localeNumber(Math.abs(place.longitude), 2)}°${place.longitude >= 0 ? "E" : "W"}`;
  return `${lat}, ${lon}`;
}

/* ------------------------------------------------------------------ */
/* Derived content: advisories, brief, model insight                   */
/* ------------------------------------------------------------------ */

function buildAdvisories(weather) {
  const items = [];
  const next24 = weather.hourly.slice(0, 24);
  const today = weather.daily[0];
  const maxGust = Math.max(...next24.map((hour) => hour.windGust ?? 0), 0);
  const maxWind = Math.max(...next24.map((hour) => hour.windSpeed ?? 0), 0);
  const totalPrecip = today?.precipitationSum ?? 0;
  const uvMax = today?.uvMax ?? 0;
  const aqi = weather.airQuality?.aqi ?? 0;
  const hasThunder = next24.slice(0, 12).some((hour) => weatherGroup(hour.code) === "thunder");
  const iceRisk = (today?.min ?? 99) <= 0.5 && totalPrecip >= 0.2;
  const officialWarnings = weather.official?.warnings ?? [];

  if (officialWarnings.length) {
    items.push({
      type: "official",
      title: tr("alerts.official"),
      body: officialWarnings[0].title || tr("alerts.officialBody"),
      severe: true,
      official: true,
    });
  }
  if (hasThunder) {
    items.push({ type: "thunder", title: tr("alerts.thunder"), body: tr("alerts.thunderBody") });
  }
  if (maxGust >= 75) {
    items.push({
      type: "wind",
      title: tr("alerts.wind"),
      body: tr("alerts.windBody", { value: formatWind(maxGust, state.units, state.locale) }),
      severe: maxGust >= 95,
    });
  }
  if (iceRisk) {
    items.push({ type: "ice", title: tr("alerts.ice"), body: tr("alerts.iceBody") });
  }
  if (totalPrecip >= 20) {
    items.push({
      type: "rain",
      title: tr("alerts.rain"),
      body: tr("alerts.rainBody", { value: formatPrecip(totalPrecip, state.units, state.locale) }),
    });
  }
  if ((today?.max ?? 0) >= 30) {
    items.push({
      type: "heat",
      title: tr("alerts.heat"),
      body: tr("alerts.heatBody", { value: formatTemp(today.max, state.units, state.locale) }),
    });
  }
  if ((today?.min ?? 99) <= -3) {
    items.push({
      type: "cold",
      title: tr("alerts.cold"),
      body: tr("alerts.coldBody", { value: formatTemp(today.min, state.units, state.locale) }),
    });
  }
  if (uvMax >= 7) {
    items.push({
      type: "uv",
      title: tr("alerts.uv"),
      body: tr("alerts.uvBody", { value: localeNumber(uvMax, 1) }),
    });
  }
  if (aqi >= 60) {
    items.push({
      type: "air",
      title: tr("alerts.air"),
      body: tr("alerts.airBody", { value: Math.round(aqi) }),
    });
  }

  return { items: items.slice(0, 4), maxWind, maxGust };
}

function buildBrief(weather) {
  const next12 = weather.hourly.slice(0, 12);
  const future = next12.slice(1);
  const group = weatherGroup(weather.current.code);
  const wetHour = future.find(
    (hour) => hour.precipitationProbability >= 48 || hour.precipitation >= 0.12,
  );
  const maxWind = Math.max(...next12.map((hour) => hour.windSpeed ?? 0), 0);
  const maxGust = Math.max(...next12.map((hour) => hour.windGust ?? 0), 0);
  const spread = weather.current.spread ?? 0;
  const confidence = weather.current.agreement || 0;
  const level = confidenceLevel(confidence);
  const spreadLabel = formatDelta(spread);
  const tempLabel = formatTemp(weather.current.temp, state.units, state.locale);
  const condition = tr(`briefWx.${group}`);
  const agreement = tr(`brief.agreement${level}`);
  const sentences = [tr("brief.condition", { condition, temp: tempLabel }), tr("brief.agreement", { label: agreement, spread: spreadLabel })];

  if (wetHour) {
    sentences.push(
      tr("brief.rain", {
        time: formatHour(wetHour.time),
        prob: formatPercent(wetHour.precipitationProbability, state.locale),
      }),
    );
  } else {
    sentences.push(tr("brief.noRain"));
  }
  if (maxWind >= 24) {
    sentences.push(tr("brief.wind", { wind: formatWind(maxWind, state.units, state.locale) }));
  }

  let headlineKey = "brief.headline.mixed";
  if (wetHour && wetHour.precipitationProbability >= 55) headlineKey = "brief.headline.rain";
  else if (group === "thunder") headlineKey = "brief.headline.thunder";
  else if (group === "snow") headlineKey = "brief.headline.snow";
  else if (maxWind >= 38) headlineKey = "brief.headline.wind";
  else if (group === "clear") headlineKey = "brief.headline.clear";
  else if (group === "cloudy" || group === "partly") headlineKey = "brief.headline.cloudy";
  else if (group === "fog") headlineKey = "brief.headline.fog";

  const temps = next12.map((hour) => hour.temp);
  const largestSpread = maxBy(next12, (hour) => hour.spread);
  return {
    headline: tr(headlineKey),
    body: sentences.join(" "),
    wetHour,
    maxWind,
    maxGust,
    spread,
    confidence,
    group,
    tempMin: Math.min(...temps),
    tempMax: Math.max(...temps),
    largestSpread,
  };
}

function modelInsight(weather) {
  const next24 = weather.hourly.slice(0, 24);
  const largest = maxBy(next24, (hour) => hour.spread);
  const sources = activeSources(weather);
  const closest = [...sources].sort(
    (a, b) => Math.abs(a.deviation ?? 99) - Math.abs(b.deviation ?? 99),
  )[0];
  const text =
    largest && largest.spread >= 0.7
      ? tr("models.largestSpread", {
          time: formatHour(largest.time),
          spread: formatDelta(largest.spread),
        })
      : tr("models.noDivergence");
  return { largest, closest, text };
}

/* ------------------------------------------------------------------ */
/* Boot / skeleton / error                                             */
/* ------------------------------------------------------------------ */

function updateBootText() {
  const bootText = document.querySelector(".boot-text");
  if (!bootText) return;
  bootText.textContent = tr("loading.models");
  const boot = document.querySelector(".boot");
  if (boot) boot.dataset.place = displayName(state.place);
}

function brandWordmark() {
  return `<span class="brand-name" aria-label="DFWMeteo"><b>DFW</b><em>Meteo</em><span class="brand-radar" aria-hidden="true"><span></span><span></span></span></span>`;
}

function renderSkeleton() {
  const place = state.place;
  app.innerHTML = `${headerMarkup()}
    <main id="main" class="shell shell--loading" aria-busy="true">
      <section class="skeleton-hero">
        <div class="skeleton skeleton-eyebrow"></div>
        <div class="skeleton skeleton-title"></div>
        <div class="skeleton skeleton-sub"></div>
        <div class="skeleton-temp"></div>
        <div class="skeleton-orbit"></div>
        <div class="skeleton-row"><span></span><span></span><span></span><span></span></div>
      </section>
      <div class="skeleton-grid">
        <div class="skeleton-panel skeleton-panel--wide"><div class="skeleton skeleton-line"></div><div class="skeleton skeleton-line short"></div><div class="skeleton skeleton-block"></div></div>
        <div class="skeleton-panel skeleton-panel--side"><div class="skeleton skeleton-line"></div><div class="skeleton skeleton-block"></div></div>
        <div class="skeleton-panel skeleton-panel--wide"><div class="skeleton skeleton-line"></div><div class="skeleton skeleton-rail"></div></div>
      </div>
      <p class="skeleton-note">${escapeHtml(
        tr("loading.place", { place: displayName(place) }),
      )}</p>
    </main>`;
  updateRefreshButton();
}

function renderError(error) {
  if (error) console.error("[dfwmeteo]", error);
  app.innerHTML = `${headerMarkup()}
    <main id="main" class="shell error-shell">
      <section class="error-card">
        <div class="error-orbit">${brandMark(58)}</div>
        <p class="eyebrow">${escapeHtml(tr("error.eyebrow"))} · ${escapeHtml(
          displayName(state.place),
        )}</p>
        <h1>${escapeHtml(tr("error.title"))}</h1>
        <p>${escapeHtml(tr("error.body"))}</p>
        <div class="error-actions">
          <button class="button button--primary" data-action="retry">${uiIcon("refresh", 17)} ${escapeHtml(
            tr("error.retry"),
          )}</button>
          <button class="button button--ghost" data-action="search">${uiIcon("search", 17)} ${escapeHtml(
            tr("error.search"),
          )}</button>
        </div>
        <p class="error-hint">${escapeHtml(
          navigator.onLine === false ? tr("error.offline") : tr("footer.legal"),
        )}</p>
      </section>
    </main>
    ${footerMarkup()}`;
}

/* ------------------------------------------------------------------ */
/* Header & hero                                                       */
/* ------------------------------------------------------------------ */

function headerMarkup() {
  const name = displayName(state.place);
  const country = countryLabel(state.place);
  return `<header class="topbar">
    <div class="topbar-inner">
      <a class="brand" href="./" data-action="home" aria-label="DFWMeteo — ${escapeHtml(
        tr("app.tagline"),
      )}">
        <span class="brand-symbol">${brandMark(32)}</span>
        <span class="brand-copy">${brandWordmark()}<small>${escapeHtml(
          tr("app.tagline"),
        )}</small></span>
      </a>
      <button class="place-pill" data-action="search" aria-label="${escapeHtml(
        tr("nav.search"),
      )} — ${escapeHtml(name)}">
        ${uiIcon("pin", 15)}
        <span><b>${escapeHtml(name)}</b><small>${escapeHtml(country)}</small></span>
        ${uiIcon("chevronDown", 13)}
      </button>
      <div class="topbar-actions">
        <button class="search-button" data-action="search" aria-label="${escapeHtml(
          tr("nav.search"),
        )}">
          ${uiIcon("search", 16)}<span>${escapeHtml(tr("nav.searchShort"))}</span><kbd>${SHORTCUT}</kbd>
        </button>
        <button class="unit-button" data-action="toggle-units" aria-label="${escapeHtml(
          tr("nav.units"),
        )}" title="${escapeHtml(
          tr(state.units === "metric" ? "nav.switchToF" : "nav.switchToC"),
        )}">${temperatureUnit()}</button>
        <button class="icon-button" data-action="settings" aria-label="${escapeHtml(
          tr("nav.settings"),
        )}" title="${escapeHtml(tr("nav.settings"))}">${uiIcon("settings", 18)}</button>
        <button class="icon-button refresh-button ${state.refreshing ? "is-spinning" : ""}" data-action="refresh" aria-label="${escapeHtml(
          tr("nav.refresh"),
        )}" title="${escapeHtml(tr("nav.refresh"))}">
          ${uiIcon("refresh", 18)}
        </button>
      </div>
    </div>
  </header>`;
}

function starsMarkup(weather) {
  let seed = Math.abs(
    Math.floor(Number(weather.location.latitude) * 1000) ^
      Math.floor(Number(weather.location.longitude) * 1000) ^
      714,
  );
  const random = () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
  const count = weather.current.isDay ? 34 : 86;
  const stars = Array.from({ length: count }, (_, index) => {
    const x = (random() * 100).toFixed(2);
    const y = (random() * 100).toFixed(2);
    const size = (random() * 1.4 + 0.55).toFixed(2);
    const opacity = (random() * 0.5 + 0.22).toFixed(2);
    const delay = (random() * 7).toFixed(1);
    const duration = (random() * 4 + 3).toFixed(1);
    return `<i class="star" style="--x:${x}%;--y:${y}%;--s:${size}px;--o:${opacity};--d:${duration}s;--delay:-${delay}s"></i>`;
  }).join("");
  return `<div class="hero-stars" aria-hidden="true">${stars}<i class="star star--bright" style="--x:71%;--y:22%;--s:2.1px;--o:.9;--d:5.4s"></i><i class="shooting-star" style="--x:66%;--y:20%"></i></div>`;
}

function particlesMarkup(group) {
  if (group === "rain" || group === "drizzle" || group === "thunder") {
    const drops = Array.from({ length: group === "drizzle" ? 14 : 30 }, (_, index) => {
      const x = ((index * 37.17) % 100).toFixed(2);
      const delay = ((index * 0.21) % 2.4).toFixed(2);
      const duration = (0.7 + ((index * 0.13) % 0.7)).toFixed(2);
      const length = 8 + ((index * 3) % 16);
      return `<i style="--x:${x}%;--delay:-${delay}s;--dur:${duration}s;--len:${length}px"></i>`;
    }).join("");
    return `<div class="rain-layer" aria-hidden="true">${drops}</div>`;
  }
  if (group === "snow") {
    const flakes = Array.from({ length: 28 }, (_, index) => {
      const x = ((index * 41.3) % 100).toFixed(2);
      const delay = ((index * 0.37) % 8).toFixed(2);
      const duration = (5 + ((index * 0.23) % 5)).toFixed(2);
      const size = 2 + ((index * 1.7) % 4);
      return `<i style="--x:${x}%;--delay:-${delay}s;--dur:${duration}s;--s:${size}px"></i>`;
    }).join("");
    return `<div class="snow-layer" aria-hidden="true">${flakes}</div>`;
  }
  if (group === "fog") {
    return `<div class="fog-layer" aria-hidden="true"><i></i><i></i><i></i></div>`;
  }
  return "";
}

function heroMarkup(weather) {
  const group = weatherGroup(weather.current.code);
  const tone = conditionTone(group);
  const confidence = weather.current.agreement || 0;
  const isDay = weather.current.isDay;
  const windDir = compassPoint(weather.current.windDirection, state.locale);
  const hasEdge = confidence >= 82 ? "high" : confidence >= 68 ? "moderate" : "low";
  const starMarkup = starsMarkup(weather);
  const currentPrecip = formatPercent(weather.current.precipitationProbability, state.locale);
  const local = localTimeParts(weather);

  return `<section class="hero hero--${tone} ${isDay ? "is-day" : "is-night"}" aria-labelledby="hero-city">
    <div class="hero-atmosphere" aria-hidden="true">
      <span class="hero-aurora hero-aurora--one"></span>
      <span class="hero-aurora hero-aurora--two"></span>
      <span class="hero-glow"></span>
      ${starMarkup}
      ${particlesMarkup(group)}
      <span class="hero-grain"></span>
    </div>
    <div class="hero-inner">
      <div class="hero-head">
        <div class="hero-location">
          <p class="eyebrow hero-eyebrow">
            <i class="status-dot status-dot--${weatherMode(weather)}"></i>
            ${escapeHtml(modeLabel())} · <span data-live-clock>${local.hour}:${local.minute}</span> ${escapeHtml(
              tr("hero.local"),
            )}
          </p>
          <h1 id="hero-city">${escapeHtml(displayName(state.place))}</h1>
          <p class="hero-sub">${escapeHtml(placeLocationLabel(state.place))} <span class="dot-sep">·</span> ${escapeHtml(
            localDateLabel(weather),
          )}</p>
        </div>
        <button class="favorite-button ${isFavorite(state.place) ? "is-favorite" : ""}" data-action="toggle-favorite" aria-label="${escapeHtml(
          isFavorite(state.place) ? tr("hero.removeFavorite") : tr("hero.addFavorite"),
        )}" title="${escapeHtml(isFavorite(state.place) ? tr("hero.removeFavorite") : tr("hero.addFavorite"))}">
          ${uiIcon("star", 20)}
        </button>
      </div>
      <div class="hero-main">
        <div class="hero-temp-block">
          <div class="temp-display">
            <span class="temp-number">${escapeHtml(
              formatTempValue(weather.current.temp, state.units, state.locale),
            )}</span><span class="temp-degree">°</span>
          </div>
          <p class="condition-line"><span class="condition-glow"></span>${escapeHtml(
            currentCondition(weather),
          )}</p>
          <p class="hero-feels">${escapeHtml(
            tr("hero.feelsHighLow", {
              feels: formatTemp(weather.current.apparent, state.units, state.locale),
              high: formatTemp(weather.current.high, state.units, state.locale),
              low: formatTemp(weather.current.low, state.units, state.locale),
            }),
          )}</p>
        </div>
        <div class="hero-visual">
          <div class="hero-glyph">${weatherGlyph(
            weather.current.code,
            isDay,
            "hero",
            "",
            currentCondition(weather),
          )}</div>
          <div class="hero-orbit-dots" aria-label="${escapeHtml(tr("models.title"))}">
            ${activeSources(weather)
              .map((source, index, list) => {
                const angle = -90 + (index * 360) / Math.max(1, list.length);
                return `<button class="orbit-dot" style="--angle:${angle.toFixed(1)}deg;--source-color:${
                  source.color
                }" data-action="model-info" data-model="${escapeHtml(source.id)}" aria-label="${escapeHtml(
                  tr("models.open", { model: source.name }),
                )}" title="${escapeHtml(source.name)} · ${Math.round(source.influence * 100)}%">
                  <span>${escapeHtml(source.shortName)} <i>${Math.round(source.influence * 100)}%</i></span>
                </button>`;
              })
              .join("")}
          </div>
          <div class="confidence-badge confidence-badge--${hasEdge}">
            ${agreementRing(confidence, 82, confidenceColor(confidence))}
            <span>${escapeHtml(tr("hero.agreement", { n: confidence }))}</span>
          </div>
        </div>
      </div>
      <div class="hero-foot">
        <div class="hero-stats">
          <div class="hero-stat">
            <span class="hero-stat-icon">${uiIcon("wind", 17)}</span>
            <div><small>${escapeHtml(tr("details.wind"))}</small><strong>${escapeHtml(
              formatWindValue(weather.current.windSpeed, state.units, state.locale),
            )} <em>${windUnit()}</em></strong><span>${escapeHtml(windDir)}</span></div>
          </div>
          <div class="hero-stat">
            <span class="hero-stat-icon">${uiIcon("droplet", 17)}</span>
            <div><small>${escapeHtml(tr("hourly.rain"))}</small><strong>${currentPrecip}</strong><span>${escapeHtml(
              tr("common.chance"),
            )}</span></div>
          </div>
          <div class="hero-stat">
            <span class="hero-stat-icon">${uiIcon("waves", 17)}</span>
            <div><small>${escapeHtml(tr("details.humidity"))}</small><strong>${Math.round(
              weather.current.humidity,
            )}<em>%</em></strong><span>${escapeHtml(
              humidityDescription(weather.current.humidity),
            )}</span></div>
          </div>
          <div class="hero-stat">
            <span class="hero-stat-icon">${uiIcon("sun", 17)}</span>
            <div><small>${escapeHtml(tr("details.uv"))}</small><strong>${localeNumber(
              weather.current.uvIndex || 0,
              1,
            )}</strong><span>${escapeHtml(
              tr(`details.uv${capitalize(uvCategory(weather.current.uvIndex))}`),
            )}</span></div>
          </div>
        </div>
        <div class="hero-meta">
          <button class="model-pill" data-action="scroll-models">
            ${modelGlyph(15)}
            <span>${escapeHtml(tr("hero.consensus", { n: sourceCount(weather) }))}</span>
            <i>${confidence}%</i>
          </button>
          <span class="updated-pill ${state.refreshing ? "is-updating" : ""}" data-updated>${escapeHtml(
            state.refreshing ? tr("common.updating") : updatedLabel(weather),
          )}</span>
        </div>
      </div>
    </div>
  </section>`;
}

function advisoryMarkup(weather) {
  const { items } = buildAdvisories(weather);
  if (!items.length) {
    return `<section class="advisory-bar advisory-bar--quiet" aria-label="${escapeHtml(
      tr("alerts.title"),
    )}">
      <div class="advisory-lead"><span class="advisory-ok">${uiIcon("check", 14)}</span><b>${escapeHtml(
        tr("alerts.none"),
      )}</b><span>${escapeHtml(tr("alerts.noneSub"))}</span></div>
      <a class="official-link" href="https://www.meteo.be/" target="_blank" rel="noreferrer noopener">${escapeHtml(
        tr("alerts.officialLink"),
      )} ${uiIcon("external", 12)}</a>
    </section>`;
  }
  const hasOfficialWarning = items.some((item) => item.official);
  return `<section class="advisory-bar" aria-label="${escapeHtml(tr("alerts.title"))}">
    <div class="advisory-lead"><span class="advisory-alert">${uiIcon("alert", 15)}</span><b>${escapeHtml(
      tr("alerts.title"),
    )}</b><span class="advisory-disclaimer">${escapeHtml(
      hasOfficialWarning ? tr("alerts.officialDisclaimer") : tr("alerts.disclaimer"),
    )}</span></div>
    <div class="advisory-items">
      ${items
        .map(
          (item) => `<span class="advisory-chip ${item.severe ? "is-severe" : ""}" title="${escapeHtml(
            item.body,
          )}">${advisoryIcon(item.type, 14)}<b>${escapeHtml(item.title)}</b><span>${escapeHtml(
            item.body,
          )}</span></span>`,
        )
        .join("")}
    </div>
    <a class="official-link" href="https://www.meteo.be/" target="_blank" rel="noreferrer noopener">${escapeHtml(
      tr("alerts.officialLink"),
    )} ${uiIcon("external", 12)}</a>
  </section>`;
}

function humidityDescription(value) {
  if (value < 35) return tr("details.humidityDry");
  if (value > 70) return tr("details.humidityHumid");
  return tr("details.humidityComfortable");
}

/* ------------------------------------------------------------------ */
/* Dashboard: brief, models, hourly, daily, details, side cards        */
/* ------------------------------------------------------------------ */

function briefMarkup(weather) {
  const brief = buildBrief(weather);
  const level = confidenceLevel(brief.confidence);
  const insight = modelInsight(weather);
  const expanded = state.briefExpanded;
  const tempRange =
    brief.tempMin === brief.tempMax
      ? formatTemp(brief.tempMin, state.units, state.locale)
      : `${formatTemp(brief.tempMin, state.units, state.locale)}–${formatTemp(
          brief.tempMax,
          state.units,
          state.locale,
        )}`;
  return `<section class="card brief-card" aria-labelledby="brief-title">
    <div class="brief-top">
      <div class="brief-kicker">
        <span class="spark-badge">${uiIcon("sparkles", 19)}</span>
        <div><p class="eyebrow">${escapeHtml(tr("brief.eyebrow"))}</p><p class="brief-label">${escapeHtml(
          tr("brief.label"),
        )}</p></div>
      </div>
      <span class="confidence-pill confidence-pill--${confidenceClass(
        brief.confidence,
      )}"><i></i>${escapeHtml(tr(`models.agreement${level}`))}</span>
    </div>
    <h2 id="brief-title" class="brief-headline">${escapeHtml(brief.headline)}</h2>
    <p class="brief-body">${escapeHtml(brief.body)}</p>
    <div class="brief-extras">
      <span>${modelGlyph(13)} ${escapeHtml(
        tr("models.total", { n: sourceCount(weather) }),
      )}</span>
      <span>${uiIcon("activity", 13)} ${escapeHtml(
        tr("hero.spread", { value: formatDelta(brief.spread) }),
      )}</span>
    </div>
    <div class="brief-footer">
      <button class="text-button" data-action="toggle-brief" aria-expanded="${expanded}" aria-controls="brief-more">
        ${escapeHtml(expanded ? tr("brief.readLess") : tr("brief.readMore"))}
        ${uiIcon(expanded ? "chevronUp" : "chevronDown", 14)}
      </button>
      <span class="brief-footnote">${escapeHtml(tr("brief.footnote"))}</span>
    </div>
    <div class="brief-more ${expanded ? "is-open" : ""}" id="brief-more">
      <div class="brief-metrics">
        <div class="brief-metric"><span>${escapeHtml(tr("brief.tempTrend"))}</span><b>${escapeHtml(
          tempRange,
        )}</b></div>
        <div class="brief-metric"><span>${escapeHtml(tr("brief.rainWindow"))}</span><b>${
          brief.wetHour
            ? `${escapeHtml(formatHour(brief.wetHour.time))} · ${escapeHtml(
                formatPercent(brief.wetHour.precipitationProbability, state.locale),
              )}`
            : escapeHtml(tr("brief.none"))
        }</b></div>
        <div class="brief-metric"><span>${escapeHtml(tr("brief.windPeak"))}</span><b>${escapeHtml(
          formatWind(brief.maxWind, state.units, state.locale),
        )}</b></div>
        <div class="brief-metric"><span>${escapeHtml(tr("brief.agreementShort"))}</span><b>${brief.confidence}%</b></div>
      </div>
      <div class="brief-insight">
        ${uiIcon("layers", 17)}
        <p>${escapeHtml(insight.text)}${insight.closest ? ` ${escapeHtml(
          `${insight.closest.shortName} ${tr("models.closest").toLowerCase()} ${formatDelta(
            insight.closest.deviation ?? 0,
          )}.`,
        )}` : ""}</p>
      </div>
      <p class="brief-note">${escapeHtml(tr("brief.footnote"))}</p>
    </div>
  </section>`;
}

const OFFICIAL_CITY_NAMES = {
  brussels: { en: "Brussels", fr: "Bruxelles", nl: "Brussel" },
  bruxelles: { en: "Brussels", fr: "Bruxelles", nl: "Brussel" },
  brussel: { en: "Brussels", fr: "Bruxelles", nl: "Brussel" },
  antwerp: { en: "Antwerp", fr: "Anvers", nl: "Antwerpen" },
  anvers: { en: "Antwerp", fr: "Anvers", nl: "Antwerpen" },
  antwerpen: { en: "Antwerp", fr: "Anvers", nl: "Antwerpen" },
  ghent: { en: "Ghent", fr: "Gand", nl: "Gent" },
  gand: { en: "Ghent", fr: "Gand", nl: "Gent" },
  gent: { en: "Ghent", fr: "Gand", nl: "Gent" },
  liège: { en: "Liège", fr: "Liège", nl: "Luik" },
  liege: { en: "Liège", fr: "Liège", nl: "Luik" },
  luik: { en: "Liège", fr: "Liège", nl: "Luik" },
  bruges: { en: "Bruges", fr: "Bruges", nl: "Brugge" },
  brugge: { en: "Bruges", fr: "Bruges", nl: "Brugge" },
  namur: { en: "Namur", fr: "Namur", nl: "Namen" },
  namen: { en: "Namur", fr: "Namur", nl: "Namen" },
  leuven: { en: "Leuven", fr: "Louvain", nl: "Leuven" },
  louvain: { en: "Leuven", fr: "Louvain", nl: "Leuven" },
  charleroi: { en: "Charleroi", fr: "Charleroi", nl: "Charleroi" },
  mechelen: { en: "Mechelen", fr: "Malines", nl: "Mechelen" },
  malines: { en: "Mechelen", fr: "Malines", nl: "Mechelen" },
  hasselt: { en: "Hasselt", fr: "Hasselt", nl: "Hasselt" },
  kortrijk: { en: "Kortrijk", fr: "Courtrai", nl: "Kortrijk" },
  courtrai: { en: "Kortrijk", fr: "Courtrai", nl: "Kortrijk" },
  ostend: { en: "Ostend", fr: "Ostende", nl: "Oostende" },
  ostende: { en: "Ostend", fr: "Ostende", nl: "Oostende" },
  oostende: { en: "Ostend", fr: "Ostende", nl: "Oostende" },
};

function officialCityName(name) {
  return OFFICIAL_CITY_NAMES[String(name || "").toLowerCase()]?.[state.locale] || name;
}

function officialMarkup(weather) {
  const official = weather.official;
  if (!official) return "";
  const cityName = officialCityName(official.name);
  const condition = tr(`wx.${weatherKey(official.current.code)}`);
  const wind =
    official.current.windSpeed == null
      ? ""
      : `${formatWindValue(official.current.windSpeed, state.units, state.locale)} ${windUnit()}`;
  const isSnapshot = official.mode === "snapshot";
  const mode = isSnapshot ? tr("official.snapshot") : tr("official.live");
  const proximity =
    official.distanceKm > 0.6
      ? tr("official.near", {
          city: cityName,
          distance: localeNumber(official.distanceKm, 1),
        })
      : tr("official.atCentre", { city: cityName });
  const warningCount = official.warnings?.length ?? 0;
  const highLow =
    official.daily?.max != null && official.daily?.min != null
      ? tr("official.highLow", {
          high: formatTemp(official.daily.max, state.units, state.locale),
          low: formatTemp(official.daily.min, state.units, state.locale),
        })
      : "";
  return `<section class="official-source ${warningCount ? "has-warning" : ""}" aria-label="${escapeHtml(
    tr("official.aria"),
  )}">
    <div class="official-head">
      <span class="official-label"><span class="official-mark">IRM</span>${escapeHtml(
        tr("official.title"),
      )}</span>
      <span class="official-mode">${escapeHtml(mode)}</span>
    </div>
    <div class="official-body">
      <span class="official-glyph">${weatherGlyph(
        official.current.code,
        official.current.isDay,
        "sm",
        "",
        condition,
      )}</span>
      <span class="official-copy">
        <b>${escapeHtml(cityName)}</b>
        <span>${escapeHtml(condition)} · ${escapeHtml(
          tr("official.observed", { time: formatHour(official.updatedAt) }),
        )}</span>
      </span>
      <strong class="official-temp">${escapeHtml(
        formatTemp(official.current.temp, state.units, state.locale),
      )}</strong>
    </div>
    <div class="official-meta">
      ${wind ? `<span>${uiIcon("wind", 11)} ${escapeHtml(wind)}</span>` : ""}
      ${highLow ? `<span>${escapeHtml(highLow)}</span>` : ""}
      <span class="official-warning">${uiIcon(
        warningCount ? "alert" : "check",
        11,
      )} ${escapeHtml(
        warningCount
          ? tr("official.warnings", { n: warningCount })
          : tr("official.noWarnings"),
      )}</span>
    </div>
    <p class="official-foot">${escapeHtml(proximity)} · ${escapeHtml(
      tr("official.note"),
    )} <a href="https://www.meteo.be/" target="_blank" rel="noreferrer noopener">${escapeHtml(
      tr("official.link"),
    )} ${uiIcon("external", 10)}</a></p>
  </section>`;
}

function modelsMarkup(weather) {
  const sources = activeSources(weather);
  const confidence = weather.current.agreement || 0;
  const level = confidenceLevel(confidence);
  const insight = modelInsight(weather);
  return `<section class="card models-card" id="models" aria-labelledby="models-title">
    <div class="card-head">
      <div><p class="eyebrow">${escapeHtml(tr("models.eyebrow"))}</p><h2 id="models-title">${escapeHtml(
        tr("models.title"),
      )}</h2></div>
      <button class="text-button text-button--small" data-action="method">${escapeHtml(
        tr("nav.method"),
      )} ${uiIcon("arrowUpRight", 13)}</button>
    </div>
    <div class="model-summary">
      ${agreementRing(confidence, 90, confidenceColor(confidence))}
      <div class="model-summary-copy">
        <strong>${escapeHtml(tr(`models.agreement${level}`))}</strong>
        <p>${escapeHtml(
          tr("models.agreementSub", {
            n: sourceCount(weather),
            spread: formatDelta(weather.current.spread),
          }),
        )}</p>
        <span class="model-summary-pill">${escapeHtml(
          weather.location.countryCode === "BE" ? tr("models.regionalPrior") : tr("models.regionalPriorOther"),
        )}</span>
      </div>
    </div>
    ${officialMarkup(weather)}
    <div class="model-list">
      ${sources
        .map(
          (source) => `<button class="model-row" data-action="model-info" data-model="${escapeHtml(
            source.id,
          )}" aria-label="${escapeHtml(tr("models.open", { model: source.name }))}" title="${escapeHtml(
            source.description,
          )}">
            <span class="model-swatch" style="--source-color:${source.color}"></span>
            <span class="model-ident"><b>${escapeHtml(source.shortName)}</b><small>${escapeHtml(
              source.center,
            )}</small></span>
            <span class="model-temp">${escapeHtml(
              formatTemp(source.current.temp, state.units, state.locale),
            )}</span>
            <span class="model-delta ${Math.abs(source.deviation ?? 0) < 0.55 ? "is-close" : ""}">${escapeHtml(
              formatDelta(source.deviation ?? 0),
            )}</span>
            <span class="model-weight"><span><i style="width:${Math.max(
              2,
              Math.round(source.influence * 100),
            )}%"></i></span><small>${Math.round(source.influence * 100)}%</small></span>
          </button>`,
        )
        .join("")}
    </div>
    <div class="model-insight">${uiIcon("activity", 16)}<span>${escapeHtml(
      insight.text,
    )}</span></div>
    <div class="model-foot">
      <p>${escapeHtml(tr("models.footnote"))}</p>
      <button class="text-button text-button--small" data-action="method">${escapeHtml(
        tr("models.how"),
      )} ${uiIcon("arrowRight", 13)}</button>
    </div>
  </section>`;
}

function hourlyMarkup(weather) {
  const hours = weather.hourly.slice(0, 24);
  const isCompare = state.hourlyView === "compare";
  const metrics = ["temp", "rain", "wind"];
  return `<section class="card hourly-card" aria-labelledby="hourly-title">
    <div class="card-head hourly-head">
      <div><p class="eyebrow">${escapeHtml(tr("hourly.eyebrow"))}</p><h2 id="hourly-title">${escapeHtml(
        tr("hourly.title"),
      )}</h2></div>
      <div class="segmented" role="group" aria-label="${escapeHtml(tr("hourly.title"))}">
        <button class="${!isCompare ? "is-active" : ""}" data-action="set-hourly-view" data-view="overview" aria-pressed="${!isCompare}">${escapeHtml(
          tr("hourly.overview"),
        )}</button>
        <button class="${isCompare ? "is-active" : ""}" data-action="set-hourly-view" data-view="compare" aria-pressed="${isCompare}">${escapeHtml(
          tr("hourly.compare"),
        )}</button>
      </div>
    </div>
    ${
      isCompare
        ? `<div class="metric-switch" role="group" aria-label="${escapeHtml(
            tr("hourly.compare"),
          )}">
            ${metrics
              .map(
                (metric) => `<button class="${state.hourlyMetric === metric ? "is-active" : ""}" data-action="set-hourly-metric" data-metric="${metric}" aria-pressed="${
                  state.hourlyMetric === metric
                }">${escapeHtml(tr(`hourly.${metric}`))}</button>`,
              )
              .join("")}
          </div>
          <div class="chart-caption">
            <span>${escapeHtml(tr(`hourly.${state.hourlyMetric}`))} · ${escapeHtml(
              state.hourlyMetric === "temp"
                ? temperatureUnit()
                : state.hourlyMetric === "rain"
                  ? "%"
                  : windUnit(),
            )}</span>
          </div>
          ${modelSpreadChart({
            hourly: weather.hourly,
            sources: weather.sources,
            metric: state.hourlyMetric,
            locale: state.locale,
            units: state.units,
            translate: tr,
          })}
          <div class="chart-footnote"><span>${escapeHtml(tr("hourly.legend"))}</span><span>${escapeHtml(
            tr("hourly.chartHint"),
          )}</span></div>`
        : `<div class="hour-rail" role="list" aria-label="${escapeHtml(tr("hourly.eyebrow"))}">
            ${hours
              .map((hour, index) => {
                const label = index === 0 ? tr("common.now") : formatHour(hour.time);
                const glyph = weatherGlyph(
                  hour.code,
                  hour.isDay,
                  "sm",
                  "",
                  tr(`wx.${weatherKey(hour.code)}`),
                );
                return `<div class="hour-cell ${index === 0 ? "is-now" : ""}" role="listitem" aria-label="${escapeHtml(
                  `${label}, ${formatTemp(hour.temp, state.units, state.locale)}, ${formatPercent(
                    hour.precipitationProbability,
                    state.locale,
                  )} ${tr("common.chance")}`,
                )}">
                  <span class="hour-label">${escapeHtml(label)}</span>
                  <span class="hour-glyph">${glyph}</span>
                  <strong class="hour-temp">${escapeHtml(
                    formatTemp(hour.temp, state.units, state.locale),
                  )}</strong>
                  <span class="hour-rain ${hour.precipitationProbability >= 45 ? "is-likely" : ""}">${uiIcon(
                    "droplet",
                    10,
                  )}${Math.round(hour.precipitationProbability)}%</span>
                  <span class="hour-bar"><i style="height:${clamp(
                    hour.precipitationProbability,
                    3,
                    100,
                  )}%"></i></span>
                </div>`;
              })
              .join("")}
          </div>
          <div class="hour-legend"><span>${uiIcon("droplet", 12)} ${escapeHtml(
            tr("hourly.rainUnit"),
          )}</span><span>${uiIcon("wind", 12)} ${escapeHtml(
            formatWind(weather.current.windSpeed, state.units, state.locale),
          )}</span><span>${uiIcon("activity", 12)} ${escapeHtml(
            tr("hourly.agreement"),
          )} ${weather.current.agreement}%</span></div>`
    }
  </section>`;
}

function dailyMarkup(weather) {
  const days = weather.daily;
  const low = Math.min(...days.map((day) => day.min));
  const high = Math.max(...days.map((day) => day.max));
  const range = Math.max(1, high - low);
  return `<section class="card daily-card" aria-labelledby="daily-title">
    <div class="card-head">
      <div><p class="eyebrow">${escapeHtml(tr("daily.eyebrow"))}</p><h2 id="daily-title">${escapeHtml(
        tr("daily.title"),
      )}</h2></div>
      <span class="subtle-pill">${escapeHtml(
        tr("daily.subtitle", { n: sourceCount(weather) }),
      )}</span>
    </div>
    <div class="day-rail">
      ${days
        .map((day, index) => {
          const name = dayName(day.date, index);
          const start = clamp(((day.min - low) / range) * 100, 0, 100);
          const width = clamp(((day.max - day.min) / range) * 100, 4, 100);
          return `<button class="day-card ${index === 0 ? "is-today" : ""}" data-action="select-day" data-date="${escapeHtml(
            day.date,
          )}" aria-label="${escapeHtml(tr("daily.select", { day: formatDateLong(day.date, state.locale) }))}">
            <span class="day-name">${escapeHtml(name)}</span>
            <span class="day-date">${escapeHtml(formatMonthDay(day.date, state.locale))}</span>
            <span class="day-glyph">${weatherGlyph(
              day.code,
              true,
              "sm",
              "",
              dayCondition(day),
            )}</span>
            <span class="day-temp"><b>${escapeHtml(
              formatTemp(day.max, state.units, state.locale),
            )}</b><em>${escapeHtml(formatTemp(day.min, state.units, state.locale))}</em></span>
            <span class="day-bar"><i style="left:${start.toFixed(2)}%;width:${width.toFixed(2)}%"></i></span>
            <span class="day-rain ${day.precipitationProbability >= 45 ? "is-likely" : ""}">${uiIcon(
              "droplet",
              10,
            )}${Math.round(day.precipitationProbability)}%</span>
          </button>`;
        })
        .join("")}
    </div>
    <div class="daily-foot">
      <span>${uiIcon("calendar", 13)} ${escapeHtml(tr("daily.detail"))}</span>
      <span>${uiIcon("layers", 13)} ${escapeHtml(tr("hourly.agreement"))} ${weather.daily[0]?.confidence ?? weather.current.agreement}%</span>
    </div>
  </section>`;
}

function detailsMarkup(weather) {
  const today = weather.daily[0];
  const trend = pressureTrend(weather.hourly);
  const uv = weather.current.uvIndex;
  const visibility = weather.current.visibility;
  const visibilityText =
    visibility >= 20
      ? tr("details.visibilityGood")
      : visibility >= 8
        ? tr("details.visibilityHaze")
        : tr("details.visibilityPoor");
  const cloudText =
    weather.current.cloudCover < 25
      ? tr("details.cloudFew")
      : weather.current.cloudCover < 75
        ? tr("details.cloudBroken")
        : tr("details.cloudOvercast");
  const feelsDelta = weather.current.apparent - weather.current.temp;
  const comfortText =
    feelsDelta < -1.5
      ? tr("details.comfortCooler")
      : feelsDelta > 1.5
        ? tr("details.comfortWarmer")
        : tr("details.comfortAligned");

  return `<section class="card details-card" aria-labelledby="details-title">
    <div class="card-head">
      <div><p class="eyebrow">${escapeHtml(tr("details.eyebrow"))}</p><h2 id="details-title">${escapeHtml(
        tr("details.title"),
      )}</h2></div>
      <span class="subtle-pill">${escapeHtml(tr("details.subtitle"))}</span>
    </div>
    <div class="details-grid">
      <article class="detail-tile detail-tile--precip">
        <div class="detail-head">${uiIcon("umbrella", 17)}<span>${escapeHtml(
          tr("details.precip"),
        )}</span><small>${escapeHtml(tr("details.precipSub"))}</small></div>
        <div class="detail-value">${escapeHtml(
          formatPrecip(today?.precipitationSum ?? 0, state.units, state.locale),
        )}</div>
        <div class="detail-sub">${escapeHtml(
          tr("details.precipChance"),
        )} ${formatPercent(today?.precipitationProbability ?? 0, state.locale)}</div>
        ${precipBars(weather.hourly, state.units)}
        <div class="detail-foot">${escapeHtml(tr("details.next24"))}</div>
      </article>

      <article class="detail-tile detail-tile--wind">
        <div class="detail-head">${uiIcon("wind", 17)}<span>${escapeHtml(tr("details.wind"))}</span><small>${escapeHtml(
          tr("details.windDir"),
        )} ${escapeHtml(compassPoint(weather.current.windDirection, state.locale))}</small></div>
        ${windCompass(
          weather.current.windDirection,
          weather.current.windSpeed,
          weather.current.windGust,
          state.units,
          state.locale,
          tr,
        )}
      </article>

      <article class="detail-tile detail-tile--uv">
        <div class="detail-head">${uiIcon("sun", 17)}<span>${escapeHtml(tr("details.uv"))}</span><small>${escapeHtml(
          tr("details.uvToday"),
        )}</small></div>
        ${uvArc(uv, today?.uvMax ?? uv, state.locale, tr)}
      </article>

      <article class="detail-tile detail-tile--visibility">
        <div class="detail-head">${uiIcon("eye", 17)}<span>${escapeHtml(
          tr("details.visibility"),
        )}</span><small>${escapeHtml(tr("details.visibilitySub"))}</small></div>
        <div class="detail-value">${escapeHtml(
          formatVisibility(visibility, state.units, state.locale),
        )}</div>
        <div class="detail-sub">${escapeHtml(visibilityText)}</div>
        ${visibilityBar(visibility, state.units, state.locale)}
      </article>

      <article class="detail-tile detail-tile--humidity">
        <div class="detail-head">${uiIcon("droplet", 17)}<span>${escapeHtml(
          tr("details.humidity"),
        )}</span><small>${escapeHtml(tr("details.dewPoint"))} ${escapeHtml(
          formatTemp(weather.current.dewPoint, state.units, state.locale),
        )}</small></div>
        <div class="humidity-body">
          ${humidityDrop(weather.current.humidity)}
          <div class="humidity-copy"><strong>${escapeHtml(
            humidityDescription(weather.current.humidity),
          )}</strong><p>${escapeHtml(tr("details.dewPoint"))} ${escapeHtml(
            formatTemp(weather.current.dewPoint, state.units, state.locale),
          )}</p></div>
        </div>
      </article>

      <article class="detail-tile detail-tile--pressure">
        <div class="detail-head">${uiIcon("gauge", 17)}<span>${escapeHtml(
          tr("details.pressure"),
        )}</span><small>${escapeHtml(tr("details.pressureTrend"))}</small></div>
        ${pressureGauge(
          weather.current.pressure,
          trend,
          state.units,
          state.locale,
          tr,
        )}
      </article>

      <article class="detail-tile detail-tile--cloud">
        <div class="detail-head">${uiIcon("cloud", 17)}<span>${escapeHtml(
          tr("details.cloud"),
        )}</span><small>${escapeHtml(tr("details.cloudSub"))}</small></div>
        <div class="cloud-body">
          ${cloudDonut(weather.current.cloudCover)}
          <div class="cloud-copy"><strong>${escapeHtml(cloudText)}</strong><p>${Math.round(
            weather.current.cloudCover,
          )}%</p></div>
        </div>
      </article>

      <article class="detail-tile detail-tile--comfort">
        <div class="detail-head">${uiIcon("thermometer", 17)}<span>${escapeHtml(
          tr("details.comfort"),
        )}</span><small>${escapeHtml(tr("details.comfortSub"))}</small></div>
        <div class="detail-value">${escapeHtml(
          formatTemp(weather.current.apparent, state.units, state.locale),
        )}</div>
        <div class="detail-sub">${escapeHtml(comfortText)}</div>
        <div class="comfort-scale">
          <span class="comfort-dot" style="left:${clamp(
            ((weather.current.apparent - Math.min(today?.min ?? 0, weather.current.temp) + 4) /
              Math.max(8, (today?.max ?? 20) - (today?.min ?? 0) + 8)) *
              100,
            4,
            96,
          )}%"></span>
        </div>
        <div class="comfort-labels"><span>${escapeHtml(
          formatTemp(today?.min ?? weather.current.temp, state.units, state.locale),
        )}</span><span>${escapeHtml(
          formatTemp(today?.max ?? weather.current.temp, state.units, state.locale),
        )}</span></div>
      </article>
    </div>
  </section>`;
}

function sunMarkup(weather) {
  const now = localTimeParts(weather);
  const sunriseMin = clockToMinutes(weather.sun.sunrise);
  const sunsetMin = clockToMinutes(weather.sun.sunset);
  const isDayNow = now.minutes >= (sunriseMin ?? 0) && now.minutes < (sunsetMin ?? 1440);
  const nextTarget = isDayNow ? sunsetMin : clockToMinutes(weather.daily[1]?.sunrise || weather.sun.sunrise);
  const countdown = nextTarget != null ? formatDurationFromNow(now.minutes, nextTarget) : "—";
  return `<section class="card sun-card" aria-labelledby="sun-title">
    <div class="card-head">
      <div><p class="eyebrow">${escapeHtml(tr("sun.eyebrow"))}</p><h2 id="sun-title">${escapeHtml(
        tr("sun.title"),
      )}</h2></div>
      <span class="subtle-pill">${escapeHtml(
        isDayNow ? tr("sun.untilSunset", { time: countdown }) : tr("sun.untilSunrise", { time: countdown }),
      )}</span>
    </div>
    ${sunArc({
      sunrise: weather.sun.sunrise,
      sunset: weather.sun.sunset,
      nowMinutes: now.minutes,
      isDay: isDayNow,
      locale: state.locale,
      translate: tr,
    })}
    <div class="sun-stats">
      <div><span>${escapeHtml(tr("sun.rise"))}</span><b>${escapeHtml(formatHour(weather.sun.sunrise))}</b></div>
      <div><span>${escapeHtml(tr("sun.set"))}</span><b>${escapeHtml(formatHour(weather.sun.sunset))}</b></div>
      <div><span>${escapeHtml(tr("sun.daylight"))}</span><b>${escapeHtml(
        formatDaylight(weather.sun.daylightSeconds, state.locale),
      )}</b></div>
    </div>
    <div class="moon-row">
      <span class="moon-visual">${moonIcon(
        weather.sun.moon.phase,
        weather.sun.moon.illumination,
        56,
      )}</span>
      <div><span class="moon-kicker">${escapeHtml(tr("sun.moon"))}</span><strong>${escapeHtml(
        tr(`sun.phase.${weather.sun.moon.nameKey}`),
      )}</strong><small>${escapeHtml(
        tr("sun.illumination", { n: weather.sun.moon.illumination }),
      )}</small></div>
    </div>
  </section>`;
}

function airMarkup(weather) {
  const air = weather.airQuality;
  if (!air) {
    return `<section class="card air-card" aria-labelledby="air-title">
      <div class="card-head"><div><p class="eyebrow">${escapeHtml(tr("air.eyebrow"))}</p><h2 id="air-title">${escapeHtml(
        tr("air.title"),
      )}</h2></div></div>
      <p class="empty-copy">${escapeHtml(tr("air.noData"))}</p>
    </section>`;
  }
  const level = aqiKey(air.level);
  const pollenValues = Object.entries(air.pollen).filter(([, value]) => value != null);
  const pollenMax = pollenValues.length ? Math.max(...pollenValues.map(([, value]) => value)) : 0;
  const pollenLevel = pollenMax <= 0 ? "none" : pollenMax < 10 ? "low" : pollenMax < 50 ? "moderate" : "high";
  return `<section class="card air-card" aria-labelledby="air-title">
    <div class="card-head">
      <div><p class="eyebrow">${escapeHtml(tr("air.eyebrow"))}</p><h2 id="air-title">${escapeHtml(
        tr("air.title"),
      )}</h2></div>
      <span class="aqi-pill" style="--aqi-color:${aqiColor(air.level)}">${escapeHtml(
        tr(`air.level.${level}`),
      )}</span>
    </div>
    <div class="air-main">
      <div class="air-index"><strong>${Math.round(air.aqi)}</strong><span>${escapeHtml(
        tr("air.aqi"),
      )}</span></div>
      <div class="air-copy">
        <p>${escapeHtml(tr(`air.level.${level}`))}</p>
        <small>${escapeHtml(tr("air.updated", { time: formatHour(air.updatedAt) }))}</small>
      </div>
    </div>
    ${aqiBar(air.aqi, state.locale, tr)}
    ${aqiSparkline(air.hourlyAqi)}
    <div class="air-pollutants">
      <div><span>${escapeHtml(tr("air.pm25"))}</span><b>${air.pm2_5 == null ? "—" : localeNumber(air.pm2_5, 1)}</b><small>µg/m³</small></div>
      <div><span>${escapeHtml(tr("air.pm10"))}</span><b>${air.pm10 == null ? "—" : localeNumber(air.pm10, 1)}</b><small>µg/m³</small></div>
      <div><span>${escapeHtml(tr("air.no2"))}</span><b>${air.no2 == null ? "—" : localeNumber(air.no2, 1)}</b><small>µg/m³</small></div>
      <div><span>${escapeHtml(tr("air.o3"))}</span><b>${air.o3 == null ? "—" : localeNumber(air.o3, 0)}</b><small>µg/m³</small></div>
    </div>
    <div class="pollen-row">
      <span class="pollen-icon">${uiIcon("leaf", 15)}</span>
      <div><span>${escapeHtml(tr("air.pollen"))}</span><strong>${escapeHtml(
        pollenLevel === "none"
          ? tr("air.pollenNone")
          : tr(`air.pollen${capitalize(pollenLevel)}`),
      )}</strong></div>
      <span class="pollen-bars">${[0, 1, 2, 3]
        .map(
          (index) =>
            `<i class="${pollenMax > (index * 12) ? "is-on" : ""}" style="--i:${index}"></i>`,
        )
        .join("")}</span>
    </div>
  </section>`;
}

function nowcastMarkup(weather) {
  const points = weather.nowcast || [];
  const hasData = points.length > 0;
  const maxProbability = hasData ? Math.max(...points.map((point) => point.probability)) : 0;
  const total = points.reduce((sum, point) => sum + point.precipitation, 0);
  const wet = hasData && (total >= 0.08 || maxProbability >= 50);
  return `<section class="card nowcast-card" aria-labelledby="nowcast-title">
    <div class="card-head">
      <div><p class="eyebrow">${escapeHtml(tr("nowcast.eyebrow"))}</p><h2 id="nowcast-title">${escapeHtml(
        tr("nowcast.title"),
      )}</h2></div>
      <span class="nowcast-state ${wet ? "is-wet" : "is-dry"}">${uiIcon(
        wet ? "umbrella" : "check",
        14,
      )}${escapeHtml(
        hasData ? (wet ? tr("nowcast.rain") : tr("nowcast.dry")) : tr("nowcast.unavailable"),
      )}</span>
    </div>
    <p class="nowcast-copy">${escapeHtml(
      hasData ? (wet ? tr("nowcast.rainSub") : tr("nowcast.drySub")) : tr("nowcast.noData"),
    )}</p>
    ${nowcastBars(points, state.units, tr)}
    <div class="nowcast-foot">
      ${
        hasData
          ? `<span>${uiIcon("clock", 12)} ${escapeHtml(
              tr("nowcast.chance", { n: Math.round(maxProbability) }),
            )}</span>`
          : `<span>${escapeHtml(tr("nowcast.noData"))}</span>`
      }
      <span>${escapeHtml(tr("nowcast.sub"))}</span>
    </div>
  </section>`;
}

function footerMarkup() {
  return `<footer class="site-footer">
    <div class="footer-top">
      <div class="footer-brand">
        ${brandWordmark()}
        <p>${escapeHtml(tr("footer.tagline"))}</p>
        <small>${escapeHtml(tr("footer.description"))}</small>
      </div>
      <div class="footer-column">
        <span>${escapeHtml(tr("footer.data"))}</span>
        <a href="https://open-meteo.com/" target="_blank" rel="noreferrer noopener">${escapeHtml(
          tr("footer.openMeteo"),
        )} ${uiIcon("external", 11)}</a>
        <p>${escapeHtml(tr("footer.models"))}</p>
        <p>${escapeHtml(tr("footer.officialSource"))}</p>
      </div>
      <div class="footer-column">
        <span>DFWMeteo</span>
        <button data-action="method">${escapeHtml(tr("footer.method"))}</button>
        <button data-action="settings">${escapeHtml(tr("footer.settings"))}</button>
        <button data-action="copy-link">${uiIcon("copy", 11)} ${escapeHtml(
          tr("footer.share"),
        )}</button>
      </div>
      <div class="footer-column footer-column--language">
        <span>${escapeHtml(tr("footer.language"))}</span>
        <div class="footer-languages">
          ${["en", "fr", "nl"]
            .map(
              (locale) =>
                `<button class="${state.locale === locale ? "is-active" : ""}" data-action="set-locale" data-locale="${locale}" aria-pressed="${
                  state.locale === locale
                }">${locale.toUpperCase()}</button>`,
            )
            .join("")}
        </div>
        <p>${escapeHtml(tr("footer.made"))}</p>
      </div>
    </div>
    <div class="footer-bottom">
      <span>${escapeHtml(tr("footer.license"))}</span>
      <span>${escapeHtml(tr("footer.legal"))}</span>
      <a href="https://www.meteo.be/" target="_blank" rel="noreferrer noopener">${escapeHtml(
        tr("footer.official"),
      )}</a>
    </div>
  </footer>`;
}

/* ------------------------------------------------------------------ */
/* Main render                                                         */
/* ------------------------------------------------------------------ */

function renderApp() {
  if (!state.weather) return;
  const weather = state.weather;
  const group = weatherGroup(weather.current.code);
  document.title = `${displayName(state.place)} — DFWMeteo`;
  app.innerHTML = `${headerMarkup()}
    ${state.cached || weather.meta.mode === "cache" ? dataBannerMarkup(weather) : ""}
    <main id="main" class="shell">
      ${heroMarkup(weather)}
      ${advisoryMarkup(weather)}
      <div class="dashboard">
        ${briefMarkup(weather)}
        ${modelsMarkup(weather)}
        ${hourlyMarkup(weather)}
        ${dailyMarkup(weather)}
        ${sunMarkup(weather)}
        ${airMarkup(weather)}
        ${nowcastMarkup(weather)}
        ${detailsMarkup(weather)}
      </div>
      ${footerMarkup()}
    </main>`;
  document.body.dataset.weather = group;
  document.body.dataset.day = weather.current.isDay ? "day" : "night";
  updateRefreshButton();
  syncModalInert();
  requestAnimationFrame(() => {
    document.documentElement.classList.add("is-rendered");
    document.querySelectorAll(".card, .hero, .advisory-bar").forEach((element, index) => {
      element.style.setProperty("--reveal-index", String(index));
    });
  });
}

function dataBannerMarkup(weather) {
  return `<div class="data-banner" role="status">
    <span class="data-banner-icon">${uiIcon("info", 15)}</span>
    <p><b>${escapeHtml(tr("error.cachedTitle"))}</b> ${escapeHtml(
      tr("error.cachedBody"),
    )}</p>
    <span class="data-banner-time">${escapeHtml(relativeUpdated(weather))}</span>
    <button class="data-banner-action" data-action="refresh">${uiIcon("refresh", 13)} ${escapeHtml(
      tr("common.retry"),
    )}</button>
  </div>`;
}

/* ------------------------------------------------------------------ */
/* Modal shell & content                                               */
/* ------------------------------------------------------------------ */

function syncModalInert() {
  const modalOpen = Boolean(state.modal);
  app.inert = modalOpen;
  if (modalOpen) app.setAttribute("aria-hidden", "true");
  else app.removeAttribute("aria-hidden");
  document.body.classList.toggle("modal-open", modalOpen);
}

function openModal(type, payload = null, { pushHistory = true } = {}) {
  state.modalTrigger = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  state.modal = { type, payload };
  if (type === "search") {
    resetSearch();
  }
  syncModalInert();
  renderModal({ focus: true });
  if (pushHistory && window.history?.pushState) {
    try {
      window.history.pushState({ dfwModal: type }, "");
    } catch {}
  }
}

function closeModal({ popHistory = true } = {}) {
  if (!state.modal) return;
  if (state.modal.type === "search") cancelSearch();
  state.modal = null;
  state.modalPayload = null;
  modalRoot.innerHTML = "";
  syncModalInert();
  const trigger = state.modalTrigger;
  state.modalTrigger = null;
  if (trigger?.isConnected) trigger.focus();

  if (popHistory && window.history?.state?.dfwModal) {
    try {
      window.history.back();
    } catch {}
  }
}

function renderModal({ focus = false, focusSelector = null } = {}) {
  if (!state.modal) {
    modalRoot.innerHTML = "";
    return;
  }
  const content = modalContent(state.modal);
  modalRoot.innerHTML = `<div class="modal-backdrop" data-action="close-modal">
    <div class="modal modal--${state.modal.type}" role="dialog" aria-modal="true" aria-labelledby="modal-title" data-modal-panel tabindex="-1">
      ${content}
    </div>
  </div>`;
  syncModalInert();
  if (focus) {
    const resolveTarget = () => {
      const dialog = modalRoot.querySelector(".modal");
      return (
        (focusSelector && dialog?.querySelector(focusSelector)) ||
        dialog?.querySelector("[data-autofocus]") ||
        dialog?.querySelector("input, button, [href], [tabindex]")
      );
    };
    resolveTarget()?.focus({ preventScroll: true });
    requestAnimationFrame(() => {
      const target = resolveTarget();
      if (target && document.activeElement !== target && document.activeElement === document.body) {
        target.focus({ preventScroll: true });
      }
    });
  }
}

function modalContent(modal) {
  switch (modal.type) {
    case "search":
      return searchModalContent();
    case "settings":
      return settingsModalContent();
    case "method":
      return methodModalContent();
    case "day":
      return dayModalContent(modal.payload);
    case "model":
      return modelModalContent(modal.payload);
    default:
      return "";
  }
}

function modalHeader({ eyebrow, title, closeLabel }) {
  return `<div class="modal-top">
    <div><p class="eyebrow">${escapeHtml(eyebrow)}</p><h2 id="modal-title">${escapeHtml(
      title,
    )}</h2></div>
    <button class="icon-button modal-close" data-action="close-modal" aria-label="${escapeHtml(
      closeLabel || tr("common.close"),
    )}">${uiIcon("x", 18)}</button>
  </div>`;
}

/* Search modal ------------------------------------------------------- */

function resetSearch() {
  cancelSearch();
  state.search = {
    query: "",
    results: [],
    loading: false,
    error: null,
    items: [],
    activeIndex: 0,
    controller: null,
    timer: null,
    locating: false,
  };
}

function cancelSearch() {
  if (state.search.timer) clearTimeout(state.search.timer);
  state.search.timer = null;
  state.search.controller?.abort();
  state.search.controller = null;
}

function searchModalContent() {
  const body = searchBodyMarkup();
  return `<div class="search-shell">
    ${modalHeader({
      eyebrow: tr("search.quick"),
      title: tr("search.title"),
      closeLabel: tr("nav.close"),
    })}
    <div class="search-field">
      ${uiIcon("search", 19)}
      <input id="search-input" type="text" placeholder="${escapeHtml(
        tr("search.placeholder"),
      )}" value="${escapeHtml(state.search.query)}" autocomplete="off" autocapitalize="off" spellcheck="false" aria-label="${escapeHtml(
        tr("search.placeholder"),
      )}" aria-controls="search-body" aria-autocomplete="list" aria-expanded="true" data-search-input data-autofocus>
      <button class="search-clear ${state.search.query ? "is-visible" : ""}" data-action="clear-search" aria-label="${escapeHtml(
        tr("common.close"),
      )}">${uiIcon("x", 14)}</button>
      <kbd>esc</kbd>
    </div>
    <div class="search-results" id="search-body">${body}</div>
    <div class="search-footer">
      <span>${escapeHtml(tr("search.footer"))}</span>
      <span>${escapeHtml(tr("footer.models"))}</span>
    </div>
  </div>`;
}

function cityChipsMarkup(list, startIndex) {
  return list
    .map((item, chipIndex) => {
      const itemIndex = startIndex + chipIndex;
      const name = displayName(item.place);
      return `<button class="city-chip ${state.search.activeIndex === itemIndex ? "is-active" : ""}" data-action="select-place" data-index="${itemIndex}" id="search-item-${itemIndex}" aria-label="${escapeHtml(
        tr("search.resultAria", {
          name,
          country: countryLabel(item.place),
        }),
      )}"><span>${escapeHtml(name)}</span><small>${escapeHtml(
        countryLabel(item.place),
      )}</small></button>`;
    })
    .join("");
}

function quickBelgianFallback() {
  const items = BELGIAN_CITIES.slice(0, 8).map((city) => ({
    type: "place",
    place: presetPlace(city),
    preset: true,
  }));
  state.search.items = items;
  state.search.activeIndex = 0;
  return `<section class="search-section"><div class="search-section-head"><h3>${escapeHtml(
    tr("search.belgian"),
  )}</h3><span>${escapeHtml(tr("search.belgium"))}</span></div><div class="city-grid">${cityChipsMarkup(
    items,
    0,
  )}</div></section>`;
}

function searchBodyMarkup() {
  const query = state.search.query.trim();
  const items = [];

  if (query.length < 2) {
    items.push({ type: "locate" });
    const favoriteItems = state.favorites.map((place) => ({ type: "place", place, favorite: true }));
    items.push(...favoriteItems);
    const belgianItems = BELGIAN_CITIES.map((city) => ({
      type: "place",
      place: presetPlace(city),
      preset: true,
    }));
    items.push(...belgianItems);
    const globalItems = GLOBAL_CITIES.map((city) => ({
      type: "place",
      place: presetPlace(city),
      preset: true,
    }));
    items.push(...globalItems);
    state.search.items = items;

    let index = 0;
    const locateMarkup = `<button class="place-row place-row--locate ${state.search.activeIndex === index ? "is-active" : ""}" data-action="locate" data-index="${index}" id="search-item-${index}">
      <span class="locate-icon">${uiIcon(state.search.locating ? "refresh" : "locate", 18)}</span>
      <span class="place-copy"><b>${escapeHtml(
        state.search.locating ? tr("search.locating") : tr("search.useLocation"),
      )}</b><small>${escapeHtml(tr("search.locationHint"))}</small></span>
      ${uiIcon("arrowRight", 15)}
    </button>`;
    index += 1;

    const favoritesMarkup = favoriteItems.length
      ? `<section class="search-section"><div class="search-section-head"><h3>${escapeHtml(
          tr("search.favorites"),
        )}</h3><span>${favoriteItems.length}</span></div><div class="place-list">${favoriteItems
          .map((item, favoriteIndex) => {
            const itemIndex = index + favoriteIndex;
            return placeRowMarkup(item.place, itemIndex, true);
          })
          .join("")}</div></section>`
      : `<section class="search-section"><div class="search-section-head"><h3>${escapeHtml(
          tr("search.favorites"),
        )}</h3></div><p class="search-empty">${escapeHtml(tr("search.noneFavorites"))}</p></section>`;
    index += favoriteItems.length;

    const belgianStart = index;
    index += belgianItems.length;
    const globalStart = index;

    return `${locateMarkup}
      ${favoritesMarkup}
      <section class="search-section"><div class="search-section-head"><h3>${escapeHtml(
        tr("search.belgian"),
      )}</h3><span>${escapeHtml(tr("search.belgium"))}</span></div><div class="city-grid">${cityChipsMarkup(
        belgianItems,
        belgianStart,
      )}</div></section>
      <section class="search-section"><div class="search-section-head"><h3>${escapeHtml(
        tr("search.global"),
      )}</h3><span>${escapeHtml(tr("search.quick"))}</span></div><div class="city-grid">${cityChipsMarkup(
        globalItems,
        globalStart,
      )}</div></section>`;
  }

  if (state.search.loading) {
    state.search.items = [];
    return `<div class="search-loading">${uiIcon("refresh", 16)}<span>${escapeHtml(
      tr("search.searching"),
    )}</span></div><div class="search-skeletons">${Array.from(
      { length: 3 },
      () => `<div class="search-skeleton"><span></span><div><i></i><i></i></div></div>`,
    ).join("")}</div>`;
  }

  if (state.search.error) {
    return `<div class="search-message search-message--error">${uiIcon("alert", 22)}<h3>${escapeHtml(
      tr("search.error"),
    )}</h3><p>${escapeHtml(state.search.error)}</p></div>${quickBelgianFallback()}`;
  }

  if (!state.search.results.length) {
    return `<div class="search-message">${uiIcon("search", 22)}<h3>${escapeHtml(
      tr("search.noResults", { query }),
    )}</h3><p>${escapeHtml(tr("search.hint"))}</p></div>${quickBelgianFallback()}`;
  }

  items.push(...state.search.results.map((place) => ({ type: "place", place })));
  state.search.items = items;
  return `<section class="search-section"><div class="search-section-head"><h3>${escapeHtml(
    tr("search.results"),
  )}</h3><span>${state.search.results.length}</span></div><div class="place-list">${state.search.results
    .map((place, index) => placeRowMarkup(place, index, false))
    .join("")}</div></section>`;
}

function placeRowMarkup(place, index, favorite) {
  const name = displayName(place);
  const country = countryLabel(place);
  return `<div class="place-row ${state.search.activeIndex === index ? "is-active" : ""}">
    <button class="place-main" data-action="select-place" data-index="${index}" id="search-item-${index}" aria-label="${escapeHtml(
      tr("search.resultAria", { name, country }),
    )}">
      <span class="country-tag">${escapeHtml(place.countryCode || "··")}</span>
      <span class="place-copy"><b>${escapeHtml(name)}</b><small>${escapeHtml(
        placeLocationLabel(place),
      )}</small></span>
      <span class="place-coords">${escapeHtml(formatPlaceCoords(place))}</span>
      ${uiIcon("arrowRight", 15)}
    </button>
    ${
      favorite
        ? `<button class="place-remove" data-action="remove-favorite" data-index="${index}" aria-label="${escapeHtml(
            tr("search.removeFavorite", { name }),
          )}" title="${escapeHtml(tr("search.removeFavorite", { name }))}">${uiIcon("x", 14)}</button>`
        : ""
    }
  </div>`;
}

function renderSearchBody() {
  const body = document.querySelector("#search-body");
  if (!body) return;
  body.innerHTML = searchBodyMarkup();
  const input = document.querySelector("#search-input");
  if (input) {
    input.setAttribute("aria-expanded", "true");
  }
  updateSearchActive(false);
}

function updateSearchActive(scroll = true) {
  const body = document.querySelector("#search-body");
  if (!body) return;
  body.querySelectorAll("[data-index]").forEach((element) => {
    element.classList.toggle(
      "is-active",
      Number(element.dataset.index) === state.search.activeIndex,
    );
  });
  const active = body.querySelector(
    `[data-index="${state.search.activeIndex}"]`,
  );
  const input = document.querySelector("#search-input");
  if (input) {
    input.setAttribute("aria-activedescendant", active?.id || "");
  }
  if (active && scroll) {
    active.scrollIntoView({ block: "nearest" });
  }
  document.querySelector(".search-clear")?.classList.toggle("is-visible", Boolean(state.search.query));
}

async function runSearch(query) {
  cancelSearch();
  if (query.trim().length < 2) return;
  state.search.loading = true;
  state.search.error = null;
  renderSearchBody();
  state.search.timer = setTimeout(async () => {
    const controller = new AbortController();
    state.search.controller = controller;
    try {
      const results = await searchPlaces(query.trim(), state.locale, {
        signal: controller.signal,
      });
      if (state.search.query.trim() !== query.trim()) return;
      state.search.results = results;
      state.search.loading = false;
      state.search.error = null;
      state.search.activeIndex = 0;
      renderSearchBody();
    } catch (error) {
      if (error.name === "AbortError") return;
      state.search.loading = false;
      state.search.error = error.message || tr("search.error");
      state.search.results = [];
      renderSearchBody();
    }
  }, 280);
}

function handleSearchInput(value) {
  state.search.query = value;
  state.search.activeIndex = 0;
  if (value.trim().length < 2) {
    cancelSearch();
    state.search.results = [];
    state.search.loading = false;
    state.search.error = null;
    renderSearchBody();
    return;
  }
  runSearch(value);
}

function selectSearchItem(index) {
  const item = state.search.items[index];
  if (!item) return;
  if (item.type === "locate") {
    locateMe();
    return;
  }
  const place = item.place;
  closeModal();
  changePlace(place);
}

function removeFavoriteByIndex(index) {
  const item = state.search.items[index];
  if (!item?.place) return;
  state.favorites = state.favorites.filter((favorite) => !isSamePlace(favorite, item.place));
  saveFavorites();
  renderSearchBody();
  if (state.weather) renderApp();
  document.querySelector("#search-input")?.focus();
  showToast(tr("search.removed", { name: displayName(item.place) }), "default");
}

async function locateMe() {
  if (!navigator.geolocation) {
    showToast(tr("search.locationError"), "error");
    return;
  }
  state.search.locating = true;
  renderSearchBody();
  navigator.geolocation.getCurrentPosition(
    async (position) => {
      try {
        const place = await reversePlace(
          position.coords.latitude,
          position.coords.longitude,
          state.locale,
        );
        state.search.locating = false;
        const resolved = normalisePlace({
          ...place,
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          name: place.name || "Current location",
        });
        closeModal();
        await changePlace(resolved);
        showToast(tr("toast.located", { name: displayName(resolved) }), "success");
      } catch {
        state.search.locating = false;
        renderSearchBody();
        showToast(tr("search.locationError"), "error");
      }
    },
    () => {
      state.search.locating = false;
      renderSearchBody();
      showToast(tr("toast.geoDenied"), "error");
    },
    { enableHighAccuracy: false, timeout: 9000, maximumAge: 10 * 60 * 1000 },
  );
}

/* Settings modal ----------------------------------------------------- */

function settingsModalContent() {
  return `<div class="settings-shell">
    ${modalHeader({
      eyebrow: tr("settings.about"),
      title: tr("settings.title"),
      closeLabel: tr("settings.close"),
    })}
    <div class="settings-body">
      <section class="settings-section">
        <div class="settings-label"><h3>${escapeHtml(tr("settings.units"))}</h3><p>${escapeHtml(
          tr("settings.unitsSub"),
        )}</p></div>
        <div class="option-grid option-grid--2">
          ${optionCard({
            action: "set-units",
            attribute: "data-units",
            value: "metric",
            selected: state.units === "metric",
            icon: "thermometer",
            title: tr("settings.metric"),
            sub: tr("settings.metricSub"),
          })}
          ${optionCard({
            action: "set-units",
            attribute: "data-units",
            value: "imperial",
            selected: state.units === "imperial",
            icon: "globe",
            title: tr("settings.imperial"),
            sub: tr("settings.imperialSub"),
          })}
        </div>
      </section>
      <section class="settings-section">
        <div class="settings-label"><h3>${escapeHtml(tr("settings.language"))}</h3><p>${escapeHtml(
          tr("settings.languageSub"),
        )}</p></div>
        <div class="option-grid option-grid--3">
          ${[
            ["en", "English"],
            ["fr", "Français"],
            ["nl", "Nederlands"],
          ]
            .map(
              ([locale, label]) => `<button class="option-card option-card--compact ${
                state.locale === locale ? "is-selected" : ""
              }" data-action="set-locale" data-locale="${locale}" aria-pressed="${
                state.locale === locale
              }">
                <span class="option-flag">${locale.toUpperCase()}</span>
                <span class="option-copy"><b>${escapeHtml(label)}</b></span>
                ${state.locale === locale ? `<span class="option-check">${uiIcon("check", 13)}</span>` : ""}
              </button>`,
            )
            .join("")}
        </div>
      </section>
      <section class="settings-section">
        <div class="settings-label"><h3>${escapeHtml(tr("settings.motion"))}</h3><p>${escapeHtml(
          tr("settings.motionSub"),
        )}</p></div>
        <div class="option-grid option-grid--2">
          ${optionCard({
            action: "set-motion",
            attribute: "data-motion",
            value: "full",
            selected: state.motion === "full",
            icon: "sparkles",
            title: tr("settings.motionOn"),
            sub: tr("settings.motionSub"),
          })}
          ${optionCard({
            action: "set-motion",
            attribute: "data-motion",
            value: "reduced",
            selected: state.motion === "reduced",
            icon: "motion",
            title: tr("settings.motionReduced"),
            sub: tr("settings.motionSub"),
          })}
        </div>
      </section>
      <section class="settings-section settings-section--row">
        <div class="settings-label"><h3>${escapeHtml(tr("settings.data"))}</h3><p>${escapeHtml(
          tr("settings.dataSub"),
        )}</p></div>
        <button class="button button--ghost button--small" data-action="method">${uiIcon(
          "layers",
          15,
        )} ${escapeHtml(tr("settings.method"))}</button>
      </section>
      <section class="settings-about">
        ${brandWordmark()}
        <p>${escapeHtml(tr("settings.aboutBody"))}</p>
        <small>${escapeHtml(tr("settings.version"))} · Open-Meteo</small>
      </section>
    </div>
  </div>`;
}

function optionCard({ action, attribute, value, selected, icon, title, sub }) {
  return `<button class="option-card ${selected ? "is-selected" : ""}" data-action="${action}" ${attribute}="${value}" aria-pressed="${selected}" ${
    selected ? "data-autofocus" : ""
  }>
    <span class="option-icon">${uiIcon(icon, 17)}</span>
    <span class="option-copy"><b>${escapeHtml(title)}</b><small>${escapeHtml(sub)}</small></span>
    ${selected ? `<span class="option-check">${uiIcon("check", 13)}</span>` : ""}
  </button>`;
}

/* Method modal ------------------------------------------------------- */

function methodModalContent() {
  const weather = state.weather;
  const sources = weather ? activeSources(weather) : [];
  const region = weightRegionLabel();
  return `<div class="method-shell">
    ${modalHeader({
      eyebrow: tr("method.eyebrow"),
      title: tr("method.title"),
      closeLabel: tr("method.closeLabel"),
    })}
    <div class="method-intro"><span class="spark-badge">${uiIcon(
      "sparkles",
      19,
    )}</span><p>${escapeHtml(tr("method.intro"))}</p></div>
    <div class="method-steps">
      ${[
        ["method.step1", "method.step1Body"],
        ["method.step2", "method.step2Body"],
        ["method.step3", "method.step3Body"],
        ["method.step4", "method.step4Body"],
      ]
        .map(
          ([titleKey, bodyKey], index) => `<article class="method-step">
            <span class="method-step-number">0${index + 1}</span>
            <h3>${escapeHtml(tr(titleKey))}</h3>
            <p>${escapeHtml(tr(bodyKey))}</p>
          </article>`,
        )
        .join("")}
    </div>
    <section class="method-section">
      <div class="method-section-head"><h3>${escapeHtml(
        tr("method.sourcesTitle"),
      )}</h3><span>${escapeHtml(tr("method.weightNote", { region }))}</span></div>
      <div class="source-table">
        ${sources
          .map(
            (source) => `<div class="source-table-row">
              <span class="model-swatch" style="--source-color:${source.color}"></span>
              <span class="source-name"><b>${escapeHtml(source.name)}</b><small>${escapeHtml(
                source.center,
              )} · ${escapeHtml(source.resolution)}</small></span>
              <span class="source-weight"><span class="weight-track"><i style="width:${Math.max(
                2,
                Math.round(source.influence * 100),
              )}%"></i></span><b>${Math.round(source.influence * 100)}%</b></span>
            </div>`,
          )
          .join("")}
      </div>
      ${
        weather
          ? `<div class="method-meta"><span>${escapeHtml(
              tr("method.generated", { time: localTimeFromIso(weather.meta.generatedAt, weather) }),
            )}</span><span>${escapeHtml(tr("method.mode"))}: ${escapeHtml(
              weatherMode(weather) === "cached" ? tr("method.modeCache") : tr("method.modeLive"),
            )}</span></div>`
          : ""
      }
    </section>
    <section class="method-section method-section--official">
      <span class="method-official-mark">IRM</span>
      <div>
        <h3>${escapeHtml(tr("method.irmTitle"))}</h3>
        <p>${escapeHtml(tr("method.irmBody"))}</p>
      </div>
    </section>
    <section class="method-section method-section--limits">
      <div class="method-section-head"><h3>${escapeHtml(tr("method.limitsTitle"))}</h3></div>
      <p>${escapeHtml(tr("method.limitsBody"))}</p>
    </section>
    <section class="method-section method-section--attribution">
      <div class="method-section-head"><h3>${escapeHtml(tr("method.attributionTitle"))}</h3></div>
      <p>${escapeHtml(tr("method.attributionBody"))}</p>
      <a class="official-link official-link--button" href="https://www.meteo.be/" target="_blank" rel="noreferrer noopener">${uiIcon(
        "external",
        13,
      )} ${escapeHtml(tr("method.official"))}</a>
    </section>
    <div class="modal-actions">
      <button class="button button--primary" data-action="close-modal">${escapeHtml(
        tr("method.close"),
      )}</button>
      <a class="button button--ghost" href="https://open-meteo.com/" target="_blank" rel="noreferrer noopener">${escapeHtml(
        tr("footer.openMeteo"),
      )} ${uiIcon("external", 13)}</a>
    </div>
  </div>`;
}

/* Day modal ---------------------------------------------------------- */

function dayModalContent(payload) {
  const date = payload?.date;
  const weather = state.weather;
  const index = weather.daily.findIndex((day) => day.date === date);
  const day = weather.daily[index] ?? weather.daily[0];
  const sources = activeSources(weather);
  return `<div class="day-shell">
    ${modalHeader({
      eyebrow: tr("day.eyebrow"),
      title: formatDateLong(day.date, state.locale),
      closeLabel: tr("day.close"),
    })}
    <div class="day-hero">
      <div class="day-hero-glyph">${weatherGlyph(
        day.code,
        true,
        "lg",
        "",
        dayCondition(day),
      )}</div>
      <div class="day-hero-copy">
        <span class="subtle-pill">${escapeHtml(dayCondition(day))}</span>
        <div class="day-hero-temps"><strong>${escapeHtml(
          formatTemp(day.max, state.units, state.locale),
        )}</strong><span>${escapeHtml(formatTemp(day.min, state.units, state.locale))}</span></div>
        <p>${escapeHtml(tr("day.confidence", { n: day.confidence }))} · ${escapeHtml(
          tr("day.spread"),
        )} ${escapeHtml(formatDelta(day.spread))}</p>
      </div>
      <div class="day-confidence">${agreementRing(day.confidence, 68, confidenceColor(day.confidence))}</div>
    </div>
    <div class="day-metrics">
      <div><span>${uiIcon("umbrella", 14)} ${escapeHtml(tr("daily.precipTotal"))}</span><b>${escapeHtml(
        formatPrecip(day.precipitationSum, state.units, state.locale),
      )}</b></div>
      <div><span>${uiIcon("droplet", 14)} ${escapeHtml(tr("daily.rainChance"))}</span><b>${escapeHtml(
        formatPercent(day.precipitationProbability, state.locale),
      )}</b></div>
      <div><span>${uiIcon("wind", 14)} ${escapeHtml(tr("daily.gust"))}</span><b>${escapeHtml(
        formatWind(day.gustMax, state.units, state.locale),
      )}</b></div>
      <div><span>${uiIcon("sun", 14)} ${escapeHtml(tr("daily.uv"))}</span><b>${localeNumber(
        day.uvMax || 0,
        1,
      )}</b></div>
      <div><span>${uiIcon("sunrise", 14)} ${escapeHtml(tr("daily.sunrise"))}</span><b>${escapeHtml(
        formatHour(day.sunrise),
      )}</b></div>
      <div><span>${uiIcon("sunset", 14)} ${escapeHtml(tr("daily.sunset"))}</span><b>${escapeHtml(
        formatHour(day.sunset),
      )}</b></div>
    </div>
    <section class="day-models">
      <div class="method-section-head"><h3>${escapeHtml(
        tr("day.models"),
      )}</h3><span>${escapeHtml(tr("day.modelNote"))}</span></div>
      <div class="day-model-table">
        <div class="day-model-head"><span>${escapeHtml(tr("day.source"))}</span><span>${escapeHtml(
          tr("day.high"),
        )}</span><span>${escapeHtml(tr("day.low"))}</span><span>${escapeHtml(
          tr("day.precip"),
        )}</span></div>
        <div class="day-model-row day-model-row--consensus">
          <span><i class="consensus-dot"></i><b>${escapeHtml(tr("day.consensus"))}</b></span>
          <b>${escapeHtml(formatTemp(day.max, state.units, state.locale))}</b>
          <b>${escapeHtml(formatTemp(day.min, state.units, state.locale))}</b>
          <b>${escapeHtml(formatPrecip(day.precipitationSum, state.units, state.locale))}</b>
        </div>
        ${sources
          .map(
            (source) => `<div class="day-model-row">
              <span><i class="model-swatch" style="--source-color:${source.color}"></i><b>${escapeHtml(
                source.shortName,
              )}</b></span>
              <b>${source.dailyHigh[index] == null ? "—" : escapeHtml(formatTemp(source.dailyHigh[index], state.units, state.locale))}</b>
              <b>${source.dailyLow[index] == null ? "—" : escapeHtml(formatTemp(source.dailyLow[index], state.units, state.locale))}</b>
              <b>${source.dailyPrecip[index] == null ? "—" : escapeHtml(formatPrecip(source.dailyPrecip[index], state.units, state.locale))}</b>
            </div>`,
          )
          .join("")}
      </div>
    </section>
    <div class="modal-actions"><button class="button button--primary" data-action="close-modal">${escapeHtml(
      tr("common.close"),
    )}</button></div>
  </div>`;
}

/* Model modal -------------------------------------------------------- */

function modelModalContent(payload) {
  const weather = state.weather;
  const source = weather.sources.find((item) => item.id === payload?.id);
  if (!source) return "";
  const index = source.current.temp;
  return `<div class="model-shell">
    ${modalHeader({
      eyebrow: tr("models.modalEyebrow"),
      title: source.name,
      closeLabel: tr("common.close"),
    })}
    <div class="model-hero">
      <span class="model-orb" style="--source-color:${source.color}">${modelGlyph(44)}</span>
      <div class="model-hero-copy">
        <p>${escapeHtml(source.description)}</p>
        <div class="model-tags"><span>${escapeHtml(source.center)}</span><span>${escapeHtml(
          source.resolution,
        )}</span><span>${escapeHtml(tr("models.available"))}</span></div>
      </div>
      <div class="model-hero-temp">${escapeHtml(
        formatTemp(index, state.units, state.locale),
      )}<small>${escapeHtml(tr("models.tempNow"))}</small></div>
    </div>
    <div class="model-stats">
      <div><span>${escapeHtml(tr("models.influence"))}</span><b>${Math.round(
        source.influence * 100,
      )}%</b></div>
      <div><span>${escapeHtml(tr("models.deviation"))}</span><b>${escapeHtml(
        formatDelta(source.deviation ?? 0),
      )}</b></div>
      <div><span>${escapeHtml(tr("models.meanDeviation"))}</span><b>${escapeHtml(
        formatAbsDelta(source.meanAbsDeviation ?? 0, state.units, state.locale, 2),
      )}</b></div>
      <div><span>${escapeHtml(tr("models.resolution"))}</span><b>${escapeHtml(
        source.resolution,
      )}</b></div>
    </div>
    <section class="model-chart-section">
      <div class="method-section-head"><h3>${escapeHtml(tr("models.hourly"))}</h3><span>${escapeHtml(
        tr("models.chartNote"),
      )}</span></div>
      ${miniSourceChart(source, weather.hourly, state.units, state.locale, tr)}
    </section>
    <div class="model-note">${uiIcon("info", 15)}<p>${escapeHtml(
      tr("models.influenceBody", { n: Math.round(source.influence * 100) }),
    )}</p></div>
    <div class="modal-actions">
      <button class="button button--primary" data-action="close-modal">${escapeHtml(
        tr("common.close"),
      )}</button>
      <button class="button button--ghost" data-action="method">${escapeHtml(tr("nav.method"))}</button>
    </div>
  </div>`;
}

function miniSourceChart(source, hourly, units, locale, translate) {
  const points = hourly.slice(0, 12);
  const width = 640;
  const height = 170;
  const pad = { top: 18, right: 12, bottom: 26, left: 38 };
  const values = points.flatMap((point, index) => {
    const own = source.hourlyTemp[index] == null ? null : tempValue(source.hourlyTemp[index], units);
    const consensus = tempValue(point.temp, units);
    return [own, consensus].filter((value) => value != null);
  });
  let min = Math.min(...values);
  let max = Math.max(...values);
  const padding = Math.max(1, (max - min) * 0.22);
  min -= padding;
  max += padding;
  const step = niceAxisStep((max - min) / 3);
  min = Math.floor(min / step) * step;
  max = Math.ceil(max / step) * step;
  const x = (index) => pad.left + (index / (points.length - 1)) * (width - pad.left - pad.right);
  const y = (value) => pad.top + ((max - value) / (max - min)) * (height - pad.top - pad.bottom);
  const sourcePath = points
    .map((_, index) => {
      const value = source.hourlyTemp[index] == null ? null : tempValue(source.hourlyTemp[index], units);
      return value == null ? null : `${x(index).toFixed(1)} ${y(value).toFixed(1)}`;
    })
    .filter(Boolean);
  const consensusPath = points.map((point, index) => `${x(index).toFixed(1)} ${y(tempValue(point.temp, units)).toFixed(1)}`);
  const ticks = [];
  for (let value = min; value <= max + step * 0.01; value += step) {
    ticks.push(value);
  }
  const grid = ticks
    .map((value) => {
      const top = y(value);
      return `<line x1="${pad.left}" x2="${width - pad.right}" y1="${top}" y2="${top}" class="chart-grid"/><text x="${pad.left - 9}" y="${top + 3.5}" text-anchor="end" class="chart-axis">${Math.round(value)}°</text>`;
    })
    .join("");
  const labels = points.map((point, index) => {
    if (index % 3 !== 0 && index !== points.length - 1) return "";
    return `<text x="${x(index)}" y="${height - 8}" text-anchor="${index === 0 ? "start" : index === points.length - 1 ? "end" : "middle"}" class="chart-axis">${escapeHtml(index === 0 ? translate("common.now") : formatHour(point.time))}</text>`;
  }).join("");
  return `<svg class="mini-chart" viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeHtml(
    `${source.name} · ${translate("models.hourly")}`,
  )}">
    ${grid}
    <path d="M${sourcePath.map((point) => point).join(" L")}" fill="none" stroke="${source.color}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M${consensusPath.join(" L")}" fill="none" stroke="rgba(255,255,255,.64)" stroke-width="1.4" stroke-dasharray="4 5" stroke-linecap="round"/>
    ${labels}
  </svg>`;
}

/* ------------------------------------------------------------------ */
/* Interactions                                                       */
/* ------------------------------------------------------------------ */

function updateRefreshButton() {
  const button = document.querySelector(".refresh-button");
  if (!button) return;
  button.classList.toggle("is-spinning", state.refreshing);
  button.setAttribute("aria-busy", String(state.refreshing));
}

function updateLiveLabels() {
  if (!state.weather) return;
  const time = localClock(state.weather);
  document.querySelectorAll("[data-live-clock]").forEach((element) => {
    element.textContent = time;
  });
  document.querySelectorAll("[data-updated]").forEach((element) => {
    element.textContent = state.refreshing ? tr("common.updating") : updatedLabel(state.weather);
    element.classList.toggle("is-updating", state.refreshing);
  });
  const currentMinute = localTimeParts(state.weather).minutes;
  if (
    state.lastRenderedMinute != null &&
    Math.floor(currentMinute / 60) !== Math.floor(state.lastRenderedMinute / 60)
  ) {
    state.lastRenderedMinute = currentMinute;
  }
}

function showToast(message, tone = "default") {
  if (!toastRoot) return;
  toastRoot.innerHTML = `<div class="toast toast--${tone}">${
    tone === "error" ? uiIcon("alert", 16) : tone === "success" ? uiIcon("check", 16) : uiIcon("info", 16)
  }<span>${escapeHtml(message)}</span></div>`;
  requestAnimationFrame(() => toastRoot.querySelector(".toast")?.classList.add("is-visible"));
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => {
    toastRoot.querySelector(".toast")?.classList.remove("is-visible");
    setTimeout(() => {
      if (toastRoot.querySelector(".toast:not(.is-visible)")) toastRoot.innerHTML = "";
    }, 280);
  }, 3400);
}

async function copyLink() {
  try {
    await navigator.clipboard.writeText(window.location.href);
    showToast(tr("toast.copy"), "success");
  } catch {
    const input = document.createElement("textarea");
    input.value = window.location.href;
    document.body.append(input);
    input.select();
    document.execCommand("copy");
    input.remove();
    showToast(tr("toast.copy"), "success");
  }
}

function focusMain() {
  document.querySelector("#main h1")?.focus?.();
}

function toggleFavorite() {
  if (!state.weather) return;
  const place = state.place;
  if (isFavorite(place)) {
    state.favorites = state.favorites.filter((favorite) => !isSamePlace(favorite, place));
    saveFavorites();
    showToast(tr("toast.favoriteRemoved"));
  } else {
    state.favorites.push(place);
    saveFavorites();
    showToast(tr("toast.favoriteAdded"), "success");
  }
  renderApp();
}

function setUnits(units) {
  state.units = units === "imperial" ? "imperial" : "metric";
  savePreferences();
  if (state.weather) renderApp();
  if (state.modal) renderModal();
  requestAnimationFrame(() => {
    document.querySelector(`[data-action="set-units"][data-units="${state.units}"]`)?.focus();
  });
}

function setLocale(locale) {
  if (!["en", "fr", "nl"].includes(locale)) return;
  state.locale = locale;
  savePreferences();
  applyPreferences();
  if (state.weather) renderApp();
  else if (state.status === "error") renderError(state.error);
  else if (state.status === "loading") renderSkeleton();
  if (state.modal) {
    renderModal();
    if (state.modal.type === "search" && state.search.query.trim().length >= 2) {
      runSearch(state.search.query);
    }
  }
  requestAnimationFrame(() => {
    document.querySelector(`[data-action="set-locale"][data-locale="${locale}"]`)?.focus();
  });
}

function setMotion(value) {
  state.motion = value === "reduced" ? "reduced" : "full";
  savePreferences();
  applyPreferences();
  if (state.modal) renderModal();
  requestAnimationFrame(() => {
    document.querySelector(`[data-action="set-motion"][data-motion="${state.motion}"]`)?.focus();
  });
}

async function changePlace(place) {
  const normalized = normalisePlace(place);
  const changed = !isSamePlace(state.place, normalized);
  state.place = normalized;
  if (state.controller) state.controller.abort();
  state.error = null;
  state.cached = false;
  state.refreshing = false;
  saveLastPlace(normalized);
  writePlaceToUrl(normalized);
  const cached = loadWeatherCache(normalized);
  if (cached) {
    state.weather = cached;
    state.status = "ready";
    state.cached = true;
    renderApp();
  } else {
    state.weather = null;
    state.status = "loading";
    renderSkeleton();
  }
  if (changed) window.scrollTo({ top: 0, behavior: state.motion === "reduced" ? "auto" : "smooth" });
  await requestWeather({ silent: Boolean(cached), initial: false });
}

async function requestWeather({ silent = false, initial = false, notify = false, force = false } = {}) {
  const seq = ++state.requestSeq;
  state.controller?.abort();
  const controller = new AbortController();
  state.controller = controller;
  state.refreshing = true;
  updateRefreshButton();
  updateLiveLabels();
  try {
    const payload = await fetchWeather(state.place, {
      signal: controller.signal,
      force,
    });
    if (seq !== state.requestSeq) return;
    state.weather = payload;
    state.cached = payload.meta.mode === "cache";
    state.place = normalisePlace({
      ...state.place,
      timezone: payload.meta.timezone,
      elevation: payload.meta.elevation,
    });
    state.status = "ready";
    state.error = null;
    state.refreshing = false;
    state.lastFetchAt = Date.now();
    state.lastRenderedMinute = localTimeParts(payload).minutes;
    saveWeatherCache(state.place, payload);
    saveLastPlace(state.place);
    writePlaceToUrl(state.place);
    renderApp();
    if (notify) showToast(tr("toast.refreshed"), "success");
  } catch (error) {
    if (seq !== state.requestSeq || error.name === "AbortError") return;
    state.refreshing = false;
    updateRefreshButton();
    if (state.weather) {
      state.cached = true;
      state.status = "ready";
      renderApp();
      if (notify) showToast(tr("toast.cache"), "warn");
    } else {
      state.status = "error";
      state.error = error.message || tr("error.body");
      renderError(state.error);
    }
  }
}

function refreshForecast({ notify = true } = {}) {
  if (!state.weather && state.status !== "error") return;
  requestWeather({ silent: true, initial: false, notify, force: true });
}

function handleAction(event) {
  const actionElement = event.target.closest("[data-action]");
  if (!actionElement) return;
  const action = actionElement.dataset.action;

  if (action === "close-modal") {
    if (
      actionElement.classList.contains("modal-backdrop") &&
      event.target !== actionElement
    ) {
      return;
    }
    closeModal();
    return;
  }

  switch (action) {
    case "search":
      event.preventDefault();
      openModal("search");
      break;
    case "settings":
      event.preventDefault();
      openModal("settings");
      break;
    case "method":
      event.preventDefault();
      openModal("method");
      break;
    case "refresh":
      event.preventDefault();
      refreshForecast({ notify: true });
      break;
    case "retry":
      event.preventDefault();
      if (state.weather) refreshForecast({ notify: true });
      else requestWeather({ silent: false, initial: false, notify: true, force: true });
      break;
    case "toggle-favorite":
      event.preventDefault();
      toggleFavorite();
      break;
    case "scroll-models":
      event.preventDefault();
      document.querySelector("#models")?.scrollIntoView({
        behavior: state.motion === "reduced" ? "auto" : "smooth",
        block: "center",
      });
      document.querySelector("#models")?.classList.add("is-flashing");
      setTimeout(() => document.querySelector("#models")?.classList.remove("is-flashing"), 1100);
      break;
    case "set-hourly-view":
      state.hourlyView = actionElement.dataset.view === "compare" ? "compare" : "overview";
      renderApp();
      break;
    case "set-hourly-metric":
      state.hourlyMetric = ["temp", "rain", "wind"].includes(actionElement.dataset.metric)
        ? actionElement.dataset.metric
        : "temp";
      renderApp();
      break;
    case "toggle-brief":
      state.briefExpanded = !state.briefExpanded;
      renderApp();
      break;
    case "select-day":
      openModal("day", { date: actionElement.dataset.date });
      break;
    case "model-info":
      openModal("model", { id: actionElement.dataset.model });
      break;
    case "set-units":
      setUnits(actionElement.dataset.units);
      break;
    case "toggle-units":
      setUnits(state.units === "metric" ? "imperial" : "metric");
      break;
    case "set-locale":
      setLocale(actionElement.dataset.locale);
      break;
    case "set-motion":
      setMotion(actionElement.dataset.motion);
      break;
    case "select-place": {
      const index = Number(actionElement.dataset.index);
      selectSearchItem(index);
      break;
    }
    case "remove-favorite": {
      const index = Number(actionElement.dataset.index);
      removeFavoriteByIndex(index);
      break;
    }
    case "locate":
      locateMe();
      break;
    case "clear-search": {
      const input = document.querySelector("#search-input");
      if (input) {
        input.value = "";
        input.focus();
      }
      handleSearchInput("");
      break;
    }
    case "copy-link":
      copyLink();
      break;
    case "home":
      event.preventDefault();
      closeModal();
      changePlace({ ...DEFAULT_PLACE, name: presetPlace(BELGIAN_CITIES[0]).name });
      break;
    default:
      break;
  }
}

function handleKeydown(event) {
  const isInput =
    event.target instanceof HTMLElement &&
    (["INPUT", "TEXTAREA", "SELECT"].includes(event.target.tagName) ||
      event.target.isContentEditable);

  if (state.modal) {
    if (event.key === "Escape") {
      event.preventDefault();
      closeModal();
      return;
    }
    if (event.key === "Tab") {
      trapFocus(event);
      return;
    }
    if (state.modal.type === "search") {
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        if (!state.search.items.length) return;
        const direction = event.key === "ArrowDown" ? 1 : -1;
        state.search.activeIndex =
          (state.search.activeIndex + direction + state.search.items.length) %
          state.search.items.length;
        updateSearchActive();
      } else if (event.key === "Enter") {
        event.preventDefault();
        selectSearchItem(state.search.activeIndex);
      }
    }
    return;
  }

  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
    event.preventDefault();
    openModal("search");
    return;
  }
  if (isInput) return;
  if (event.key === "/") {
    event.preventDefault();
    openModal("search");
  } else if (event.key.toLowerCase() === "r") {
    event.preventDefault();
    refreshForecast({ notify: true });
  }
}

function trapFocus(event) {
  const dialog = modalRoot.querySelector(".modal");
  if (!dialog) return;
  const focusables = [...dialog.querySelectorAll(
    'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
  )].filter((element) => element.offsetParent !== null);
  if (!focusables.length) {
    event.preventDefault();
    dialog.focus();
    return;
  }
  const first = focusables[0];
  const last = focusables[focusables.length - 1];
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}

function handleDocumentInput(event) {
  if (event.target?.matches?.("[data-search-input]")) {
    handleSearchInput(event.target.value);
  }
}

function bindEvents() {
  document.addEventListener("click", handleAction);
  document.addEventListener("keydown", handleKeydown);
  document.addEventListener("input", handleDocumentInput);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible" && state.status === "ready") {
      if (Date.now() - state.lastFetchAt > 8 * 60 * 1000) {
        refreshForecast({ notify: false });
      }
    }
  });
  window.addEventListener("online", () => {
    if (state.status === "error") refreshForecast({ notify: false });
  });
  setInterval(updateLiveLabels, 30000);
  setInterval(() => {
    if (
      state.status === "ready" &&
      document.visibilityState === "visible" &&
      Date.now() - state.lastFetchAt > 8 * 60 * 1000
    ) {
      refreshForecast({ notify: false });
    }
  }, 120000);
}

function setupBackButtonHandler() {
  // 1. Android Capacitor Native Back Button listener
  const capacitorApp = window.CapacitorApp || window.Capacitor?.Plugins?.App;
  if (capacitorApp?.addListener) {
    try {
      capacitorApp.addListener("backButton", ({ canGoBack }) => {
        if (state.modal) {
          closeModal();
        } else if (canGoBack && window.history.length > 1) {
          window.history.back();
        } else if (capacitorApp.exitApp) {
          capacitorApp.exitApp();
        }
      });
    } catch (err) {
      console.warn("[dfwmeteo] Capacitor backButton listener error:", err);
    }
  }

  // 2. Web / PWA browser popstate listener
  window.addEventListener("popstate", () => {
    if (state.modal) {
      closeModal({ popHistory: false });
    }
  });
}

function registerServiceWorker() {
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("./sw.js").catch((err) => {
        console.warn("[dfwmeteo] SW registration error:", err);
      });
    });
  }
}

async function init() {
  loadPreferences();
  bindEvents();
  setupBackButtonHandler();
  registerServiceWorker();
  updateBootText();
  const urlPlace = placeFromUrl();
  const storedPlace = loadLastPlace();
  const initialPlace = normalisePlace(urlPlace || storedPlace || DEFAULT_PLACE);
  state.place = initialPlace;
  writePlaceToUrl(initialPlace);
  saveLastPlace(initialPlace);

  const cached = loadWeatherCache(initialPlace);
  if (cached) {
    state.weather = cached;
    state.cached = true;
    state.status = "ready";
    state.lastRenderedMinute = localTimeParts(cached).minutes;
    renderApp();
  } else {
    state.status = "booting";
    updateBootText();
  }
  await requestWeather({ silent: Boolean(cached), initial: true, notify: false });
}

init().catch((error) => {
  console.error(error);
  state.status = "error";
  state.error = error.message;
  renderError(error.message);
});

function capitalize(value) {
  return String(value || "").charAt(0).toUpperCase() + String(value || "").slice(1);
}
