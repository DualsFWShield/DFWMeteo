/**
 * Official Belgian IRM / KMI integration layer:
 * - Parsing IRM API responses into standard WMO format
 * - Live fetch via CORS gateway (or direct in native environments)
 * - Fallback to 34-city regional snapshot
 */

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

function md5(str) {
  function safeAdd(x, y) {
    const l = (x & 0xffff) + (y & 0xffff);
    const m = (x >> 16) + (y >> 16) + (l >> 16);
    return (m << 16) | (l & 0xffff);
  }
  function bitRol(n, c) {
    return (n << c) | (n >>> (32 - c));
  }
  function cmn(q, a, b, x, s, t) {
    return safeAdd(bitRol(safeAdd(safeAdd(a, q), safeAdd(x, t)), s), b);
  }
  function ff(a, b, c, d, x, s, t) {
    return cmn((b & c) | (~b & d), a, b, x, s, t);
  }
  function gg(a, b, c, d, x, s, t) {
    return cmn((b & d) | (c & ~d), a, b, x, s, t);
  }
  function hh(a, b, c, d, x, s, t) {
    return cmn(b ^ c ^ d, a, b, x, s, t);
  }
  function ii(a, b, c, d, x, s, t) {
    return cmn(c ^ (b | ~d), a, b, x, s, t);
  }

  const bin = [];
  for (let i = 0; i < str.length * 8; i += 8) {
    bin[i >> 5] |= (str.charCodeAt(i / 8) & 255) << (i % 32);
  }
  bin[str.length * 8 >> 5] |= 0x80 << ((str.length * 8) % 32);
  bin[(((str.length * 8 + 64) >>> 9) << 4) + 14] = str.length * 8;

  let a = 1732584193, b = -271733879, c = -1732584194, d = 271733878;
  for (let i = 0; i < bin.length; i += 16) {
    const oa = a, ob = b, oc = c, od = d;
    a = ff(a, b, c, d, bin[i], 7, -680876936);
    d = ff(d, a, b, c, bin[i + 1], 12, -389564586);
    c = ff(c, d, a, b, bin[i + 2], 17, 606105819);
    b = ff(b, c, d, a, bin[i + 3], 22, -1044525330);
    a = ff(a, b, c, d, bin[i + 4], 7, -176418897);
    d = ff(d, a, b, c, bin[i + 5], 12, 1200080426);
    c = ff(c, d, a, b, bin[i + 6], 17, -1473231341);
    b = ff(b, c, d, a, bin[i + 7], 22, -45705983);
    a = ff(a, b, c, d, bin[i + 8], 7, 1770035416);
    d = ff(d, a, b, c, bin[i + 9], 12, -1958414417);
    c = ff(c, d, a, b, bin[i + 10], 17, -42063);
    b = ff(b, c, d, a, bin[i + 11], 22, -1990404162);
    a = ff(a, b, c, d, bin[i + 12], 7, 1804603682);
    d = ff(d, a, b, c, bin[i + 13], 12, -40341101);
    c = ff(c, d, a, b, bin[i + 14], 17, -1502002290);
    b = ff(b, c, d, a, bin[i + 15], 22, 1236535329);

    a = gg(a, b, c, d, bin[i + 1], 5, -165796510);
    d = gg(d, a, b, c, bin[i + 6], 9, -1069501632);
    c = gg(c, d, a, b, bin[i + 11], 14, 643717713);
    b = gg(b, c, d, a, bin[i], 20, -373897302);
    a = gg(a, b, c, d, bin[i + 5], 5, -701558691);
    d = gg(d, a, b, c, bin[i + 10], 9, 38016083);
    c = gg(c, d, a, b, bin[i + 15], 14, -660478335);
    b = gg(b, c, d, a, bin[i + 4], 20, -405537848);
    a = gg(a, b, c, d, bin[i + 9], 5, 568446438);
    d = gg(d, a, b, c, bin[i + 14], 9, -1019803690);
    c = gg(c, d, a, b, bin[i + 3], 14, -187363961);
    b = gg(b, c, d, a, bin[i + 8], 20, 1163531501);
    a = gg(a, b, c, d, bin[i + 13], 5, -1444681467);
    d = gg(d, a, b, c, bin[i + 2], 9, -51403784);
    c = gg(c, d, a, b, bin[i + 7], 14, 1735328473);
    b = gg(b, c, d, a, bin[i + 12], 20, -1926607734);

    a = hh(a, b, c, d, bin[i + 5], 4, -378558);
    d = hh(d, a, b, c, bin[i + 8], 11, -2022574463);
    c = hh(c, d, a, b, bin[i + 11], 16, 1839030562);
    b = hh(b, c, d, a, bin[i + 14], 23, -35309556);
    a = hh(a, b, c, d, bin[i + 1], 4, -1530992060);
    d = hh(d, a, b, c, bin[i + 4], 11, 1272893353);
    c = hh(c, d, a, b, bin[i + 7], 16, -155497632);
    b = hh(b, c, d, a, bin[i + 10], 23, -1094730640);
    a = hh(a, b, c, d, bin[i + 13], 4, 681279174);
    d = hh(d, a, b, c, bin[i], 11, -358537222);
    c = hh(c, d, a, b, bin[i + 3], 16, -722521979);
    b = hh(b, c, d, a, bin[i + 6], 23, 76029189);
    a = hh(a, b, c, d, bin[i + 9], 4, -640364487);
    d = hh(d, a, b, c, bin[i + 12], 11, -421815835);
    c = hh(c, d, a, b, bin[i + 15], 16, 530742520);
    b = hh(b, c, d, a, bin[i + 2], 23, -995338651);

    a = ii(a, b, c, d, bin[i], 6, -198630844);
    d = ii(d, a, b, c, bin[i + 7], 10, 1126891415);
    c = ii(c, d, a, b, bin[i + 14], 15, -1416354905);
    b = ii(b, c, d, a, bin[i + 5], 21, -57434055);
    a = ii(a, b, c, d, bin[i + 12], 6, 1700485571);
    d = ii(d, a, b, c, bin[i + 3], 10, -1894986606);
    c = ii(c, d, a, b, bin[i + 10], 15, -1051523);
    b = ii(b, c, d, a, bin[i + 1], 21, -2054922799);
    a = ii(a, b, c, d, bin[i + 8], 6, 1873313359);
    d = ii(d, a, b, c, bin[i + 15], 10, -30611744);
    c = ii(c, d, a, b, bin[i + 6], 15, -1560198380);
    b = ii(b, c, d, a, bin[i + 13], 21, 1309151649);
    a = ii(a, b, c, d, bin[i + 4], 6, -145523070);
    d = ii(d, a, b, c, bin[i + 11], 10, -1120210379);
    c = ii(c, d, a, b, bin[i + 2], 15, 718787259);
    b = ii(b, c, d, a, bin[i + 9], 21, -343485551);

    a = safeAdd(a, oa);
    b = safeAdd(b, ob);
    c = safeAdd(c, oc);
    d = safeAdd(d, od);
  }
  return [a, b, c, d]
    .map((v) => {
      let s = "";
      for (let i = 0; i < 4; i++) s += ((v >> (i * 8)) & 255).toString(16).padStart(2, "0");
      return s;
    })
    .join("");
}

function belgianDateKey(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Brussels",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((p) => [p.type, p.value]));
  return `${values.day}/${values.month}/${values.year}`;
}

function irmApiKey() {
  return md5(`r9EnW374jkJ9acc;getForecasts;${belgianDateKey()}`);
}

export function isBelgianPlace(place) {
  if (place.countryCode === "BE") return true;
  const lat = Number(place.latitude);
  const lon = Number(place.longitude);
  return lat >= 49.45 && lat <= 51.55 && lon >= 2.45 && lon <= 6.5;
}

export function irmCodeToWmo(value) {
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

function numberOrNull(value) {
  if (value === null || value === undefined || value === "") return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function localized(value, lang) {
  if (typeof value === "string") return value;
  if (!value || typeof value !== "object") return "";
  return String(value[lang] ?? value.en ?? value.fr ?? value.nl ?? "");
}

function parseWarnings(raw, lang) {
  const source = raw?.for?.warning;
  if (!Array.isArray(source)) return [];
  const result = [];
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

export function parseIrmForecast({
  raw,
  latitude,
  longitude,
  distanceKm = 0,
  lang = "en",
  mode = "live",
  snapshotAt,
}) {
  const obs = raw?.obs;
  const hourly = Array.isArray(raw?.for?.hourly) ? raw.for.hourly[0] : null;
  const obsTemp = numberOrNull(obs?.temp);
  const hourlyTemp = numberOrNull(hourly?.temp);
  const temp = obsTemp ?? hourlyTemp;
  if (temp == null) return null;

  const dailyRaw = Array.isArray(raw?.for?.daily) ? raw.for.daily : [];
  const dayPeriod =
    dailyRaw.find((period) => period?.dayNight === "d" && numberOrNull(period?.tempMax) != null) ??
    dailyRaw.find((period) => numberOrNull(period?.tempMax) != null) ??
    null;
  const horizon = dailyRaw.slice(0, 4);
  const maxima = horizon
    .map((period) => numberOrNull(period?.tempMax))
    .filter((value) => value != null);
  const minima = horizon
    .map((period) => numberOrNull(period?.tempMin))
    .filter((value) => value != null);
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

export async function loadIrmSnapshot(place) {
  if (!isBelgianPlace(place)) return null;
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
  if (!nearest || nearestDistance > 60) return null;
  return {
    ...nearest.official,
    latitude: Number(place.latitude),
    longitude: Number(place.longitude),
    distanceKm: Math.round(nearestDistance * 10) / 10,
    snapshotAt: snapshot.generatedAt,
    mode: "snapshot",
  };
}

export async function fetchIrmOfficial(place, lang = "en") {
  if (!isBelgianPlace(place)) return null;

  const lat = Number(place.latitude);
  const lon = Number(place.longitude);
  const key = irmApiKey();
  const directUrl = `https://app.meteo.be/services/appv4/?s=getForecasts&k=${key}&lat=${lat.toFixed(6)}&long=${lon.toFixed(6)}`;

  // 1. Direct fetch or CORS proxy for web
  try {
    const proxyUrl = `https://corsproxy.io/?url=${encodeURIComponent(directUrl)}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 6000);
    const response = await fetch(proxyUrl, {
      signal: controller.signal,
      headers: { accept: "application/json" },
    });
    clearTimeout(timer);
    if (response.ok) {
      const raw = await response.json();
      const parsed = parseIrmForecast({
        raw,
        latitude: lat,
        longitude: lon,
        distanceKm: 0,
        lang,
        mode: "live",
      });
      if (parsed) return parsed;
    }
  } catch {}

  // 2. Fallback to comprehensive Belgian snapshot (34 regional hubs)
  return loadIrmSnapshot(place);
}
