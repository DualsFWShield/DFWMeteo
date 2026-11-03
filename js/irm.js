/**
 * Official Belgian IRM / KMI integration layer
 * Based on the Home Assistant IRM / KMI integration by Noah Bruijninckx & contributors
 *
 * Provides:
 * - MD5 signature generation for IRM API (r9EnW374jkJ9acc;method;dd/mm/yyyy)
 * - IrmKmiApiClient & IrmKmiApiClientHa for live weather, warnings, hourly, daily, and radar animation
 * - PollenParser for SVG pollen reports
 * - RainGraphGenerator for smoothed precipitation radar curves with uncertainty cone
 * - Automatic regional snapshot fallback (data/irm.json) for 100% offline & zero-latency reliability
 */

/**
 * ============================================================================
 * 1. MD5 UTILITY (Required for IRM/KMI API key)
 * ============================================================================
 */
export function md5(string) {
  function cmn(q, a, b, x, s, t) {
    a = add32(add32(a, q), add32(x, t));
    return add32((a << s) | (a >>> (32 - s)), b);
  }
  function ff(a, b, c, d, x, s, t) { return cmn((b & c) | ((~b) & d), a, b, x, s, t); }
  function gg(a, b, c, d, x, s, t) { return cmn((b & d) | (c & (~d)), a, b, x, s, t); }
  function hh(a, b, c, d, x, s, t) { return cmn(b ^ c ^ d, a, b, x, s, t); }
  function ii(a, b, c, d, x, s, t) { return cmn(c ^ (b | (~d)), a, b, x, s, t); }

  function md5cycle(x, k) {
    let [a, b, c, d] = x;
    a = ff(a, b, c, d, k[0], 7, -680876936); d = ff(d, a, b, c, k[1], 12, -389564586);
    c = ff(c, d, a, b, k[2], 17, 606105819); b = ff(b, c, d, a, k[3], 22, -1044525330);
    a = ff(a, b, c, d, k[4], 7, -176418897); d = ff(d, a, b, c, k[5], 12, 1200080426);
    c = ff(c, d, a, b, k[6], 17, -1473231341); b = ff(b, c, d, a, k[7], 22, -45705983);
    a = ff(a, b, c, d, k[8], 7, 1770035416); d = ff(d, a, b, c, k[9], 12, -1958414417);
    c = ff(c, d, a, b, k[10], 17, -42063); b = ff(b, c, d, a, k[11], 22, -1990404162);
    a = ff(a, b, c, d, k[12], 7, 1804603682); d = ff(d, a, b, c, k[13], 12, -40341101);
    c = ff(c, d, a, b, k[14], 17, -1502002290); b = ff(b, c, d, a, k[15], 22, 1236535329);

    a = gg(a, b, c, d, k[1], 5, -165796510); d = gg(d, a, b, c, k[6], 9, -1069501632);
    c = gg(c, d, a, b, k[11], 14, 643717713); b = gg(b, c, d, a, k[0], 20, -373897302);
    a = gg(a, b, c, d, k[5], 5, -701558691); d = gg(d, a, b, c, k[10], 9, 38016083);
    c = gg(c, d, a, b, k[15], 14, -660478335); b = gg(b, c, d, a, k[4], 20, -405537848);
    a = gg(a, b, c, d, k[9], 5, 568446438); d = gg(d, a, b, c, k[14], 9, -1019803690);
    c = gg(c, d, a, b, k[3], 14, -187363961); b = gg(b, c, d, a, k[8], 20, 1163531501);
    a = gg(a, b, c, d, k[13], 5, -1444681467); d = gg(d, a, b, c, k[2], 9, -51403784);
    c = gg(c, d, a, b, k[7], 14, 1735328473); b = gg(b, c, d, a, k[12], 20, -1926607734);

    a = hh(a, b, c, d, k[5], 4, -378558); d = hh(d, a, b, c, k[8], 11, -2022574463);
    c = hh(c, d, a, b, k[11], 16, 1839030562); b = hh(b, c, d, a, k[14], 23, -35309556);
    a = hh(a, b, c, d, k[1], 4, -1530992060); d = hh(d, a, b, c, k[4], 11, 1272893353);
    c = hh(c, d, a, b, k[7], 16, -155497632); b = hh(b, c, d, a, k[10], 23, -1094730640);
    a = hh(a, b, c, d, k[13], 4, 681279174); d = hh(d, a, b, c, k[0], 11, -358537222);
    c = hh(c, d, a, b, k[3], 16, -722521979); b = hh(b, c, d, a, k[6], 23, 76029189);
    a = hh(a, b, c, d, k[9], 4, -640364487); d = hh(d, a, b, c, k[12], 11, -421815835);
    c = hh(c, d, a, b, k[15], 16, 530742520); b = hh(b, c, d, a, k[2], 23, -995338651);

    a = ii(a, b, c, d, k[0], 6, -198630844); d = ii(d, a, b, c, k[7], 10, 1126891415);
    c = ii(c, d, a, b, k[14], 15, -1416354905); b = ii(b, c, d, a, k[5], 21, -57434055);
    a = ii(a, b, c, d, k[12], 6, 1700485571); d = ii(d, a, b, c, k[3], 10, -1894986606);
    c = ii(c, d, a, b, k[10], 15, -1051523); b = ii(b, c, d, a, k[1], 21, -2054922799);
    a = ii(a, b, c, d, k[8], 6, 1873313359); d = ii(d, a, b, c, k[15], 10, -30611744);
    c = ii(c, d, a, b, k[6], 15, -1560198380); b = ii(b, c, d, a, k[13], 21, 1309151649);
    a = ii(a, b, c, d, k[4], 6, -145523070); d = ii(d, a, b, c, k[11], 10, -1120210379);
    c = ii(c, d, a, b, k[2], 15, 718787259); b = ii(b, c, d, a, k[9], 21, -343485551);

    x[0] = add32(a, x[0]); x[1] = add32(b, x[1]); x[2] = add32(c, x[2]); x[3] = add32(d, x[3]);
  }

  function md51(s) {
    const n = s.length;
    const state = [1732584193, -271733879, -1732584194, 271733878];
    let i;
    for (i = 64; i <= s.length; i += 64) {
      md5cycle(state, md5blk(s.substring(i - 64, i)));
    }
    s = s.substring(i - 64);
    const tail = [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0];
    for (i = 0; i < s.length; i++) tail[i >> 2] |= s.charCodeAt(i) << ((i % 4) << 3);
    tail[i >> 2] |= 0x80 << ((i % 4) << 3);
    if (i > 55) {
      md5cycle(state, tail);
      for (i = 0; i < 16; i++) tail[i] = 0;
    }
    tail[14] = n * 8;
    md5cycle(state, tail);
    return state;
  }

  function md5blk(s) {
    const md5blks = [];
    for (let i = 0; i < 64; i += 4) {
      md5blks[i >> 2] = s.charCodeAt(i) + (s.charCodeAt(i + 1) << 8) + (s.charCodeAt(i + 2) << 16) + (s.charCodeAt(i + 3) << 24);
    }
    return md5blks;
  }

  const hex_chr = '0123456789abcdef'.split('');
  function rhex(n) {
    let s = '';
    for (let j = 0; j < 4; j++) s += hex_chr[(n >> (j * 8 + 4)) & 0x0F] + hex_chr[(n >> (j * 8)) & 0x0F];
    return s;
  }
  function add32(a, b) { return (a + b) & 0xFFFFFFFF; }
  return md51(string).map(rhex).join('');
}

/**
 * ============================================================================
 * 2. CONSTANTS AND ENUMS
 * ============================================================================
 */
export const ConditionEvol = Object.freeze({
  ONE_WAY: 'one_way',
  TWO_WAYS: 'two_ways',
  STABLE: 'stable'
});

export const RadarStyle = Object.freeze({
  OPTION_STYLE_STD: 'standard_style',
  OPTION_STYLE_CONTRAST: 'contrast_style',
  OPTION_STYLE_YELLOW_RED: 'yellow_red_style',
  OPTION_STYLE_SATELLITE: 'satellite_style'
});

export const PollenName = Object.freeze({
  ALDER: 'alder',
  ASH: 'ash',
  BIRCH: 'birch',
  GRASSES: 'grasses',
  HAZEL: 'hazel',
  MUGWORT: 'mugwort',
  OAK: 'oak'
});

export const PollenLevel = Object.freeze({
  NONE: 'none',
  ACTIVE: 'active',
  GREEN: 'green',
  YELLOW: 'yellow',
  ORANGE: 'orange',
  RED: 'red',
  PURPLE: 'purple'
});

export const WarningType = Object.freeze({
  COLD: 'cold',
  COLDSPELL: 'coldspell',
  FOG: 'fog',
  HEAT: 'heat',
  ICE_OR_SNOW: 'ice_or_snow',
  RAIN: 'rain',
  STORM_SURGE: 'storm_surge',
  THUNDER: 'thunder',
  THUNDERSTORM_LARGE_RAINFALL: 'thunderstorm_large_rainfall',
  THUNDERSTORM_STRONG_GUSTS: 'thunderstorm_strong_gusts',
  THUNDER_WIND_RAIN: 'thunder_wind_rain',
  WIND: 'wind',
  UNKNOWN: 'unknown'
});

export const POLLEN_LEVEL_TO_COLOR = {
  'null': PollenLevel.GREEN,
  'low': PollenLevel.YELLOW,
  'moderate': PollenLevel.ORANGE,
  'high': PollenLevel.RED,
  'very high': PollenLevel.PURPLE,
  'active': PollenLevel.ACTIVE
};

export const MAP_WARNING_ID_TO_SLUG = {
  0: WarningType.WIND,
  1: WarningType.RAIN,
  2: WarningType.ICE_OR_SNOW,
  3: WarningType.THUNDER,
  7: WarningType.FOG,
  9: WarningType.COLD,
  10: WarningType.HEAT,
  12: WarningType.THUNDER_WIND_RAIN,
  13: WarningType.THUNDERSTORM_STRONG_GUSTS,
  14: WarningType.THUNDERSTORM_LARGE_RAINFALL,
  15: WarningType.STORM_SURGE,
  17: WarningType.COLDSPELL
};

export const WWEVOL_TO_ENUM_MAP = {
  null: ConditionEvol.STABLE,
  undefined: ConditionEvol.STABLE,
  0: ConditionEvol.ONE_WAY,
  1: ConditionEvol.TWO_WAYS
};

export const IRM_KMI_TO_HA_CONDITION_MAP = {
  "0_d": "sunny", "0_n": "clear-night",
  "1_d": "sunny", "1_n": "clear-night",
  "2_d": "lightning-rainy", "2_n": "lightning-rainy",
  "3_d": "partlycloudy", "3_n": "partlycloudy",
  "4_d": "pouring", "4_n": "pouring",
  "5_d": "lightning-rainy", "5_n": "lightning-rainy",
  "6_d": "pouring", "6_n": "pouring",
  "7_d": "lightning-rainy", "7_n": "lightning-rainy",
  "8_d": "snowy-rainy", "8_n": "snowy-rainy",
  "9_d": "snowy-rainy", "9_n": "snowy-rainy",
  "10_d": "lightning-rainy", "10_n": "lightning-rainy",
  "11_d": "snowy", "11_n": "snowy",
  "12_d": "snowy", "12_n": "snowy",
  "13_d": "lightning-rainy", "13_n": "lightning-rainy",
  "14_d": "cloudy", "14_n": "cloudy",
  "15_d": "cloudy", "15_n": "cloudy",
  "16_d": "pouring", "16_n": "pouring",
  "17_d": "lightning-rainy", "17_n": "lightning-rainy",
  "18_d": "rainy", "18_n": "rainy",
  "19_d": "pouring", "19_n": "pouring",
  "20_d": "snowy-rainy", "20_n": "snowy-rainy",
  "21_d": "rainy", "21_n": "rainy",
  "22_d": "snowy", "22_n": "snowy",
  "23_d": "snowy", "23_n": "snowy",
  "24_d": "fog", "24_n": "fog",
  "25_d": "fog", "25_n": "fog",
  "26_d": "fog", "26_n": "fog",
  "27_d": "fog", "27_n": "fog"
};

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

function floatOrNone(v) {
  if (v === null || v === undefined || v === "") return null;
  const f = parseFloat(v);
  return isNaN(f) ? null : f;
}

function numberOrZero(v) {
  return typeof v === 'number' && !isNaN(v) ? v : 0;
}

/**
 * ============================================================================
 * 3. POLLEN PARSER
 * ============================================================================
 */
export class PollenParser {
  constructor(xmlString) {
    this._xml = xmlString;
  }

  static getDefaultData() {
    const data = {};
    Object.values(PollenName).forEach(k => data[k] = PollenLevel.NONE);
    return data;
  }

  getPollenData() {
    const pollenData = PollenParser.getDefaultData();
    let doc;
    try {
      const parser = new DOMParser();
      doc = parser.parseFromString(this._xml, "image/svg+xml");
      if (doc.querySelector("parsererror")) return pollenData;
    } catch {
      return pollenData;
    }

    const tspans = Array.from(doc.querySelectorAll("tspan"));
    const circles = Array.from(doc.querySelectorAll("circle"));
    const knownPollens = new Set(Object.values(PollenName));

    const pollens = {};
    const pollenLevels = {};

    tspans.forEach(e => {
      const txt = e.textContent ? e.textContent.trim() : null;
      const x = e.getAttribute("x");
      if (!txt) return;

      if (knownPollens.has(txt.toLowerCase())) {
        pollens[x] = txt.toLowerCase();
      }
      if (txt in POLLEN_LEVEL_TO_COLOR) {
        pollenLevels[x] = POLLEN_LEVEL_TO_COLOR[txt];
      }
    });

    const levelDots = circles.map(c => c.getAttribute("cx")).filter(Boolean);

    for (const [position, pollen] of Object.entries(pollens)) {
      if (position !== null && position in pollenLevels) {
        pollenData[pollen] = pollenLevels[position];
      }
      if (![PollenLevel.NONE, PollenLevel.ACTIVE].includes(pollenData[pollen])) {
        continue;
      }

      for (const dot of levelDots) {
        const relX = parseFloat(position) - parseFloat(dot);
        if (isNaN(relX)) continue;
        if (relX >= 24 && relX <= 34) pollenData[pollen] = PollenLevel.GREEN;
        else if (relX >= 13 && relX <= 23) pollenData[pollen] = PollenLevel.YELLOW;
        else if (relX >= -5 && relX <= 5) pollenData[pollen] = PollenLevel.ORANGE;
        else if (relX >= -23 && relX <= -13) pollenData[pollen] = PollenLevel.RED;
        else if (relX >= -34 && relX <= -24) pollenData[pollen] = PollenLevel.PURPLE;
      }
    }
    return pollenData;
  }
}

/**
 * ============================================================================
 * 4. API CLIENT
 * ============================================================================
 */
export class IrmKmiApiClient {
  constructor(corsProxy = "") {
    this.COORD_DECIMALS = 6;
    this._baseUrl = "https://app.meteo.be/services/appv4/";
    this.corsProxy = corsProxy;
  }

  static _apiKey(methodName = "getForecasts") {
    const now = new Date();
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone: "Europe/Brussels",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }).formatToParts(now);
    const v = Object.fromEntries(parts.map((p) => [p.type, p.value]));
    const dateStr = `${v.day}/${v.month}/${v.year}`;
    return md5(`r9EnW374jkJ9acc;${methodName};${dateStr}`);
  }

  async _apiWrapper(params = {}, baseUrl = null, options = {}) {
    const targetUrl = new URL(baseUrl || this._baseUrl);
    Object.entries(params).forEach(([k, val]) => targetUrl.searchParams.set(k, String(val)));

    const finalUrl = this.corsProxy
      ? `${this.corsProxy}${encodeURIComponent(targetUrl.toString())}`
      : targetUrl.toString();

    const response = await fetch(finalUrl, {
      signal: options.signal,
      cache: options.cache || "default",
      headers: { accept: "application/json" },
    });
    if (!response.ok) {
      throw new Error(`HTTP error: ${response.status}`);
    }
    return response;
  }

  async getForecastsCoord(coord, options = {}) {
    const lat = Number(coord.lat).toFixed(this.COORD_DECIMALS);
    const long = Number(coord.long).toFixed(this.COORD_DECIMALS);

    const res = await this._apiWrapper({
      s: "getForecasts",
      k: IrmKmiApiClient._apiKey("getForecasts"),
      lat,
      long
    }, null, options);
    return await res.json();
  }

  async getSvg(url, params = {}) {
    const res = await this._apiWrapper(params, url);
    return await res.text();
  }
}

export class IrmKmiApiClientHa extends IrmKmiApiClient {
  constructor(corsProxy = "", cdtMap = null) {
    super(corsProxy);
    this._apiData = {};
    this._cdtMap = cdtMap || IRM_KMI_TO_HA_CONDITION_MAP;
  }

  _getCondition(ww, dayNight) {
    return this._cdtMap[`${ww}_${dayNight}`] || null;
  }

  setApiData(data) {
    this._apiData = data || {};
  }

  async refreshForecastsCoord(coord) {
    this._apiData = await this.getForecastsCoord(coord);
  }

  getCity() { return this._apiData?.cityName || null; }
  getCountry() { return this._apiData?.country || null; }

  _getUvIndex() {
    const modules = this._apiData?.module;
    if (!Array.isArray(modules)) return null;
    const uvMod = modules.find(m => m.type === "uv");
    return uvMod?.data?.levelValue ?? null;
  }

  _getNowHourly() {
    const hourly = this._apiData?.for?.hourly;
    if (!Array.isArray(hourly) || hourly.length === 0) return null;
    const currentHour = String(new Date().getHours()).padStart(2, '0');
    for (const item of hourly.slice(0, 4)) {
      if (String(item.hour).padStart(2, '0') === currentHour) {
        return item;
      }
    }
    return hourly[0];
  }

  getCurrentWeather() {
    const nowHourly = this._getNowHourly() || {};
    const obs = this._apiData?.obs || {};

    let windBearing = null;
    const dirText = nowHourly?.windDirectionText?.en;
    if (dirText && dirText !== "VAR" && nowHourly.windDirection !== undefined) {
      const dir = parseFloat(nowHourly.windDirection);
      if (!isNaN(dir)) windBearing = (dir + 180) % 360;
    }

    const dayNight = obs.dayNight || nowHourly.dayNight || "d";

    return {
      condition: this._getCondition(obs.ww ?? nowHourly.ww, dayNight),
      code: irmCodeToWmo(obs.ww ?? nowHourly.ww),
      temperature: floatOrNone(obs.temp ?? nowHourly.temp),
      wind_speed: floatOrNone(nowHourly.windSpeedKm),
      wind_gust_speed: floatOrNone(nowHourly.windPeakSpeedKm),
      wind_bearing: windBearing,
      pressure: floatOrNone(nowHourly.pressure),
      uv_index: this._getUvIndex(),
      is_day: dayNight === "d"
    };
  }

  getRadarForecast() {
    const data = this._apiData?.animation;
    if (!data || typeof data !== 'object') return [];
    const sequence = data.sequence || [];
    const unit = data.unit?.en || "mm/10min";

    const ratios = sequence.filter(f => f.position > 0).map(f => f.value / f.position);
    const ratio = ratios.length > 0 ? ratios.reduce((a, b) => a + b, 0) / ratios.length : 0;

    return sequence.map(f => ({
      datetime: f.time,
      native_precipitation: f.value,
      rain_forecast_max: Number((f.positionHigher * ratio).toFixed(2)),
      rain_forecast_min: Number((f.positionLower * ratio).toFixed(2)),
      might_rain: f.positionHigher > 0,
      unit
    }));
  }

  getHourlyForecast() {
    const data = this._apiData?.for?.hourly;
    if (!Array.isArray(data) || data.length === 0) return [];

    const forecasts = [];
    let day = new Date();
    day.setHours(0, 0, 0, 0);

    data.forEach((f, idx) => {
      if ("dateShow" in f && idx > 0) {
        day = new Date(day.getTime() + 86400000);
      }
      if (f.hour === undefined || f.hour === null) return;

      const fDate = new Date(day);
      fDate.setHours(parseInt(f.hour, 10));

      let windBearing = null;
      if (f.windDirectionText?.en !== "VAR" && f.windDirection != null) {
        const dir = parseFloat(f.windDirection);
        if (!isNaN(dir)) windBearing = (dir + 180) % 360;
      }

      forecasts.push({
        datetime: fDate.toISOString(),
        hour: `${String(f.hour).padStart(2, '0')}:00`,
        condition: this._getCondition(f.ww, f.dayNight),
        code: irmCodeToWmo(f.ww),
        native_precipitation: floatOrNone(f.precipQuantity),
        native_temperature: floatOrNone(f.temp),
        precipitation_probability: f.precipChance != null ? parseInt(f.precipChance, 10) : null,
        native_wind_speed: floatOrNone(f.windSpeedKm),
        native_wind_gust_speed: floatOrNone(f.windPeakSpeedKm),
        wind_bearing: windBearing,
        native_pressure: floatOrNone(f.pressure),
        is_daytime: f.dayNight === "d"
      });
    });

    return forecasts;
  }

  getDailyForecast(lang = 'fr') {
    const data = this._apiData?.for?.daily;
    if (!Array.isArray(data) || data.length === 0) return [];

    return data.map(f => {
      let tempMax = floatOrNone(f.tempMax);
      let tempMin = floatOrNone(f.tempMin);
      if (tempMin !== null && tempMax !== null && tempMin > tempMax) {
        [tempMin, tempMax] = [tempMax, tempMin];
      }

      return {
        dayName: f.dayName?.[lang] || f.dayName?.en || f.timestamp?.slice(0, 10) || "--",
        condition: this._getCondition(f.ww1, f.dayNight),
        code: irmCodeToWmo(f.ww1 ?? f.ww2),
        native_precipitation: floatOrNone(f.precipQuantity),
        native_temperature: tempMax,
        native_templow: tempMin,
        precipitation_probability: f.precipChance ?? null,
        text: f.text?.[lang] || "",
        is_daytime: f.dayNight === "d"
      };
    });
  }

  getWarnings(lang = 'fr') {
    const warningData = this._apiData?.for?.warning;
    if (!Array.isArray(warningData) || warningData.length === 0) return [];

    const result = [];
    for (const d of warningData) {
      const id = parseInt(d?.warningType?.id, 10);
      if (isNaN(id) || !d.fromTimestamp || !d.toTimestamp) continue;

      const level = parseInt(d.warningLevel, 10);
      result.push({
        slug: MAP_WARNING_ID_TO_SLUG[id] || WarningType.UNKNOWN,
        id,
        level: isNaN(level) ? null : level,
        title: d.warningType?.name?.[lang] || d.warningType?.name?.en || "",
        text: d.text?.[lang] || d.text?.en || "",
        startsAt: String(d.fromTimestamp),
        endsAt: String(d.toTimestamp)
      });
    }
    return result;
  }

  getAnimationData(lang = 'fr') {
    const anim = this._apiData?.animation;
    if (!anim || !Array.isArray(anim.sequence)) return null;

    const now = new Date();
    let mostRecentIdx = 0;

    const sequence = anim.sequence.map((item, idx) => {
      const t = new Date(item.time);
      if (t <= now) mostRecentIdx = idx;
      return {
        time: t,
        value: numberOrZero(item.value),
        position: numberOrZero(item.position),
        position_lower: numberOrZero(item.positionLower),
        position_higher: numberOrZero(item.positionHigher),
        uri: item.uri || null,
      };
    });

    return {
      sequence,
      most_recent_image_idx: mostRecentIdx,
      hint: anim.sequenceHint?.[lang] || anim.sequenceHint?.en || "",
      unit: anim.unit?.[lang] || anim.unit?.en || "mm/10min",
      country: anim.country || "BE",
      localisationLayer: anim.localisationLayer || null,
      localisationLayerRatioX: floatOrNone(anim.localisationLayerRatioX),
      localisationLayerRatioY: floatOrNone(anim.localisationLayerRatioY),
    };
  }

  async getPollen() {
    const modules = this._apiData?.module || [];
    let svgUrl = null;
    for (const m of modules) {
      if (m.type === "svg" && m.data?.url?.en?.includes("pollen")) {
        svgUrl = m.data.url.en;
        break;
      }
    }
    if (!svgUrl) return PollenParser.getDefaultData();

    try {
      const svgStr = await this.getSvg(svgUrl);
      return new PollenParser(svgStr).getPollenData();
    } catch {
      return PollenParser.getDefaultData();
    }
  }
}

/**
 * ============================================================================
 * 5. RAIN GRAPH GENERATOR (SVG smoothed curves & uncertainty cone)
 * ============================================================================
 */
export class RainGraphGenerator {
  static buildSvg(animData, { theme = "aurora", lang = "fr" } = {}) {
    if (!animData || !animData.sequence || animData.sequence.length === 0) {
      return `<div class="empty-copy"><p>Aucune donnée radar IRM disponible pour cette position.</p></div>`;
    }

    const width = 640;
    const height = 220;
    const inset = 34;
    const topSpace = 38;
    const graphHeight = 125;
    const graphBottom = topSpace + graphHeight;
    const seq = animData.sequence;
    const count = seq.length;
    const graphWidth = width - 2 * inset;
    const interval = graphWidth / Math.max(1, count - 1);

    // Smoothed quadratic Bezier curve
    const buildCurvedPath = (points) => {
      if (points.length < 2) return "";
      let d = `M ${points[0][0]} ${points[0][1]}`;
      for (let i = 1; i < points.length; i++) {
        const xMid = (points[i - 1][0] + points[i][0]) / 2;
        const yMid = (points[i - 1][1] + points[i][1]) / 2;
        d += ` Q ${points[i - 1][0]} ${points[i - 1][1]} ${xMid} ${yMid}`;
      }
      const last = points[points.length - 1];
      d += ` Q ${last[0]} ${last[1]} ${last[0]} ${last[1]}`;
      return d;
    };

    const mainPoints = [];
    const higherPoints = [];
    const lowerPoints = [];

    seq.forEach((item, i) => {
      const x = inset + i * interval;
      mainPoints.push([x, topSpace + (1 - item.position) * graphHeight]);
      higherPoints.push([x, topSpace + (1 - item.position_higher) * graphHeight]);
      lowerPoints.unshift([x, topSpace + (1 - item.position_lower) * graphHeight]);
    });

    const chancePath = buildCurvedPath([...higherPoints, ...lowerPoints]) + " Z";
    const mainPath = buildCurvedPath(mainPoints);

    // Theme color adjustments
    const isNothing = theme === "nothing";
    const isPixel = theme === "pixel";
    const primaryColor = isNothing ? "#ffffff" : isPixel ? "#8ab4f8" : "#38bdf8";
    const accentColor = isNothing ? "#ff281e" : isPixel ? "#81c995" : "#38bdf8";
    const fontClass = isNothing ? 'font-family: ui-monospace, monospace;' : 'font-family: var(--font-ui);';

    let barsSvg = "";
    seq.forEach((item, i) => {
      const x = inset + i * interval;
      const isHour = item.time.getMinutes() === 0;
      const barH = isHour ? 11 : 6;

      if (i === animData.most_recent_image_idx) {
        const nowLabel = lang === "nl" ? "Nu" : lang === "en" ? "Now" : "Maintenant";
        const valText = `${nowLabel} (${item.value} ${animData.unit})`;
        barsSvg += `<line x1="${x}" y1="${topSpace}" x2="${x}" y2="${graphBottom}" stroke="${accentColor}" stroke-dasharray="4" stroke-width="2" opacity="0.85"/>`;
        barsSvg += `<circle cx="${x}" cy="${topSpace + (1 - item.position) * graphHeight}" r="4.5" fill="${accentColor}" />`;
        barsSvg += `<text x="${x}" y="${topSpace - 12}" fill="${accentColor}" font-size="12" font-weight="600" text-anchor="middle" style="${fontClass}">${valText}</text>`;
      }

      barsSvg += `<line x1="${x}" y1="${graphBottom - barH}" x2="${x}" y2="${graphBottom}" stroke="${isHour ? 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,0.25)'}" stroke-width="${isHour ? 1.5 : 1}"/>`;

      if (isHour) {
        const hStr = `${String(item.time.getHours()).padStart(2, '0')}h`;
        barsSvg += `<text x="${x}" y="${graphBottom + 20}" fill="rgba(255,255,255,0.6)" font-size="11" text-anchor="middle" style="${fontClass}">${hStr}</text>`;
      }
    });

    return `
    <svg viewBox="0 0 ${width} ${height}" class="irm-radar-svg" role="img" aria-label="IRM Radar graph">
      <defs>
        <linearGradient id="irm-curve-cone" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="${primaryColor}" stop-opacity="${isNothing ? '0.2' : '0.35'}"/>
          <stop offset="100%" stop-color="${primaryColor}" stop-opacity="0.02"/>
        </linearGradient>
      </defs>
      <path d="${chancePath}" fill="url(#irm-curve-cone)" />
      <path d="${mainPath}" fill="none" stroke="${primaryColor}" stroke-width="3" stroke-linecap="round" />
      ${barsSvg}
      <line x1="${inset}" y1="${graphBottom}" x2="${width - inset}" y2="${graphBottom}" stroke="rgba(255,255,255,0.18)" stroke-width="1" />
    </svg>`;
  }
}

/**
 * ============================================================================
 * 6. GEOLOCATION & CACHE INTEGRATION
 * ============================================================================
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

export function isBelgianPlace(place) {
  if (!place) return false;
  if (place.countryCode === "BE") return true;
  const lat = Number(place.latitude);
  const lon = Number(place.longitude);
  return lat >= 49.45 && lat <= 51.55 && lon >= 2.45 && lon <= 6.5;
}

export async function loadIrmSnapshot(place, lang = "fr") {
  if (!isBelgianPlace(place)) return null;
  if (!irmSnapshotPromise) {
    irmSnapshotPromise = fetch("./data/irm.json", {
      headers: { accept: "application/json" },
      cache: "no-store",
    })
      .then((res) => (res.ok ? res.json() : null))
      .catch(() => null);
  }
  const snapshot = await irmSnapshotPromise;
  if (!snapshot?.cities?.length) return null;

  let nearest = null;
  let nearestDistance = Infinity;
  for (const city of snapshot.cities) {
    const dist = distanceKm(place, city);
    if (dist < nearestDistance) {
      nearest = city;
      nearestDistance = dist;
    }
  }

  if (!nearest || nearestDistance > 65) return null;

  const client = new IrmKmiApiClientHa();
  client.setApiData(nearest.raw);

  const current = client.getCurrentWeather();
  const daily = client.getDailyForecast(lang)[0] || null;
  const warnings = client.getWarnings(lang);
  const animation = client.getAnimationData(lang);

  return {
    provider: "IRM / KMI",
    name: nearest.name || client.getCity() || "Belgique",
    latitude: Number(place.latitude),
    longitude: Number(place.longitude),
    distanceKm: Math.round(nearestDistance * 10) / 10,
    updatedAt: nearest.raw?.obs?.timestamp || snapshot.generatedAt,
    snapshotAt: snapshot.generatedAt,
    mode: "snapshot",
    current: {
      temp: current.temperature,
      code: current.code,
      isDay: current.is_day,
      windSpeed: current.wind_speed,
      windGust: current.wind_gust_speed,
      windDirection: current.wind_bearing,
      precipitation: null,
      precipitationProbability: daily?.precipitation_probability ?? null,
      pressure: current.pressure,
      uvIndex: current.uv_index,
    },
    daily: daily ? {
      max: daily.native_temperature,
      min: daily.native_templow,
      code: daily.code,
      precipitationProbability: daily.precipitation_probability,
      text: daily.text,
    } : null,
    warnings,
    animation,
  };
}

export async function fetchIrmOfficial(place, lang = "fr", { force = false } = {}) {
  if (!isBelgianPlace(place)) return null;

  if (force) {
    irmSnapshotPromise = null;
  }

  const lat = Number(place.latitude);
  const lon = Number(place.longitude);

  // 1. Try direct live fetch with IrmKmiApiClientHa
  try {
    const client = new IrmKmiApiClientHa();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4500);

    const raw = await client.getForecastsCoord({ lat, long: lon }, { signal: controller.signal });
    clearTimeout(timer);

    if (raw && (raw.obs || raw.for)) {
      client.setApiData(raw);
      const current = client.getCurrentWeather();
      const daily = client.getDailyForecast(lang)[0] || null;
      const warnings = client.getWarnings(lang);
      const animation = client.getAnimationData(lang);

      return {
        provider: "IRM / KMI",
        name: client.getCity() || place.name || "Belgique",
        latitude: lat,
        longitude: lon,
        distanceKm: 0,
        updatedAt: raw.obs?.timestamp || new Date().toISOString(),
        snapshotAt: null,
        mode: "live",
        current: {
          temp: current.temperature,
          code: current.code,
          isDay: current.is_day,
          windSpeed: current.wind_speed,
          windGust: current.wind_gust_speed,
          windDirection: current.wind_bearing,
          precipitation: null,
          precipitationProbability: daily?.precipitation_probability ?? null,
          pressure: current.pressure,
          uvIndex: current.uv_index,
        },
        daily: daily ? {
          max: daily.native_temperature,
          min: daily.native_templow,
          code: daily.code,
          precipitationProbability: daily.precipitation_probability,
          text: daily.text,
        } : null,
        warnings,
        animation,
      };
    }
  } catch {
    // Ignore error and fall back to local snapshot
  }

  // 2. Reliable Fallback: Comprehensive Belgian snapshot
  return loadIrmSnapshot(place, lang);
}
