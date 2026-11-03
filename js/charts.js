import {
  clamp,
  compassPoint,
  escapeHtml,
  formatHour,
  formatNumber,
  formatPrecip,
  formatPressure,
  formatTemp,
  formatTempValue,
  formatVisibility,
  formatWindValue,
  percentile,
  tempValue,
  uvCategory,
} from "./format.js";
import { uiIcon } from "./icons.js";

function linePath(points) {
  const valid = points.filter((point) => point && Number.isFinite(point.y));
  if (!valid.length) return "";
  return valid
    .map((point, index) => `${index === 0 ? "M" : "L"}${point.x.toFixed(2)} ${point.y.toFixed(2)}`)
    .join(" ");
}

function niceStep(rawStep) {
  if (!Number.isFinite(rawStep) || rawStep <= 0) return 1;
  const exponent = Math.floor(Math.log10(rawStep));
  const fraction = rawStep / 10 ** exponent;
  const nice = fraction <= 1 ? 1 : fraction <= 2 ? 2 : fraction <= 5 ? 5 : 10;
  return nice * 10 ** exponent;
}

function areaPath(top, bottom) {
  const topValid = top.filter((point) => Number.isFinite(point.y));
  const bottomValid = bottom.filter((point) => Number.isFinite(point.y));
  if (topValid.length < 2 || bottomValid.length < 2) return "";
  return `${topValid
    .map((point, index) => `${index === 0 ? "M" : "L"}${point.x.toFixed(2)} ${point.y.toFixed(2)}`)
    .join(" ")} ${bottomValid
    .reverse()
    .map((point) => `L${point.x.toFixed(2)} ${point.y.toFixed(2)}`)
    .join(" ")} Z`;
}

export function modelSpreadChart({
  hourly,
  sources,
  metric = "temp",
  locale = "en",
  units = "metric",
  translate,
}) {
  const points = hourly.slice(0, 24);
  if (points.length < 2) return "";

  const activeSources = sources.filter((source) => source.available);
  const width = 780;
  const height = 286;
  const margin = { top: 20, right: 16, bottom: 38, left: 48 };
  const plotWidth = width - margin.left - margin.right;
  const plotHeight = height - margin.top - margin.bottom;
  const x = (index) => margin.left + (index / (points.length - 1)) * plotWidth;

  const config = {
    temp: {
      unit: "°",
      aria: translate("hourly.tempUnit"),
      value: (source, index) =>
        source.hourlyTemp[index] == null ? null : tempValue(source.hourlyTemp[index], units),
      consensus: (point) => tempValue(point.temp, units),
      formatTick: (value) => `${Math.round(value)}°`,
      formatValue: (value) => formatTemp(value, units === "metric" ? "metric" : "metric", locale),
    },
    rain: {
      unit: "%",
      aria: translate("hourly.rainUnit"),
      value: (source, index) => source.hourlyPrecipProbability[index] ?? null,
      consensus: (point) => point.precipitationProbability,
      formatTick: (value) => `${Math.round(value)}%`,
      formatValue: (value) => (value == null ? "—" : `${Math.round(value)}%`),
    },
    wind: {
      unit: units === "imperial" ? "mph" : "km/h",
      aria: translate("hourly.windUnit"),
      value: (source, index) =>
        source.hourlyWind[index] == null ? null : tempValue(source.hourlyWind[index], units),
      consensus: (point) => tempValue(point.windSpeed, units),
      formatTick: (value) => `${Math.round(value)}`,
      formatValue: (value) => `${Math.round(value)}`,
    },
  }[metric];

  const allValues = [];
  for (let index = 0; index < points.length; index += 1) {
    const consensus = config.consensus(points[index]);
    if (consensus != null) allValues.push(consensus);
    for (const source of activeSources) {
      const value = config.value(source, index);
      if (value != null) allValues.push(value);
    }
  }

  let min = Math.min(...allValues);
  let max = Math.max(...allValues);
  let tickValues = [];
  if (!Number.isFinite(min) || !Number.isFinite(max)) {
    min = 0;
    max = 1;
  }
  if (metric === "rain") {
    min = 0;
    max = 100;
    tickValues = [0, 25, 50, 75, 100];
  } else if (metric === "temp") {
    const rawMin = Math.min(...allValues);
    const rawMax = Math.max(...allValues);
    const marginTemp = 2;
    const targetMin = rawMin - marginTemp;
    const targetMax = rawMax + marginTemp;
    const step = niceStep((targetMax - targetMin) / 4);
    min = Math.floor(targetMin / step) * step;
    max = Math.ceil(targetMax / step) * step;
    const count = Math.max(2, Math.round((max - min) / step));
    tickValues = Array.from({ length: count + 1 }, (_, index) => min + step * index);
  } else {
    const padding = Math.max((max - min) * 0.18, 2);
    min -= padding;
    max += padding;
    if (metric === "wind") min = Math.max(0, min);
    if (max - min < 4) {
      const middle = (min + max) / 2;
      min = middle - 3;
      max = middle + 3;
    }
    const step = niceStep((max - min) / 4);
    const roundedMin = Math.floor(min / step) * step;
    const roundedMax = Math.ceil(max / step) * step;
    const count = Math.max(2, Math.round((roundedMax - roundedMin) / step));
    tickValues = Array.from({ length: count + 1 }, (_, index) => roundedMin + step * index);
    min = roundedMin;
    max = roundedMax;
  }
  const y = (value) =>
    margin.top + ((max - value) / Math.max(0.0001, max - min)) * plotHeight;

  const gridLines = tickValues
    .map((value) => {
      const top = y(value);
      return `<line x1="${margin.left}" x2="${width - margin.right}" y1="${top.toFixed(1)}" y2="${top.toFixed(1)}" class="chart-grid"/>
      <text x="${margin.left - 12}" y="${(top + 3.5).toFixed(1)}" text-anchor="end" class="chart-axis">${config.formatTick(value)}</text>`;
    })
    .join("");

  const consensusValues = points.map((point) => config.consensus(point));
  const sourceMatrix = points.map((_, index) =>
    activeSources
      .map((source) => config.value(source, index))
      .filter((value) => value != null),
  );
  const bandTop = sourceMatrix.map((values, index) => ({
    x: x(index),
    y: y(percentile(values, 0.9) ?? consensusValues[index] ?? min),
  }));
  const bandBottom = sourceMatrix.map((values, index) => ({
    x: x(index),
    y: y(percentile(values, 0.1) ?? consensusValues[index] ?? min),
  }));

  const sourceLines = activeSources
    .map((source) => {
      const path = linePath(
        points.map((_, index) => ({ x: x(index), y: y(config.value(source, index)) })),
      );
      return `<path d="${path}" fill="none" stroke="${source.color}" stroke-width="1.35" stroke-linecap="round" stroke-linejoin="round" opacity=".62"/>`;
    })
    .join("");

  const consensusPath = linePath(
    consensusValues.map((value, index) => ({
      x: x(index),
      y: value == null ? null : y(value),
    })),
  );

  const xLabels = points
    .map((point, index) => {
      if (index % 3 !== 0 && index !== points.length - 1) return "";
      const label = index === 0 ? translate("common.now") : formatHour(point.time);
      return `<text x="${x(index).toFixed(1)}" y="${height - 12}" text-anchor="${
        index === 0 ? "start" : index === points.length - 1 ? "end" : "middle"
      }" class="chart-axis">${escapeHtml(label)}</text>`;
    })
    .join("");

  const hits = points
    .map((point, index) => {
      const values = activeSources
        .map((source) => ({ source, value: config.value(source, index) }))
        .filter((item) => item.value != null);
      const consensus = config.consensus(point);
      const closest = [...values].sort(
        (a, b) => Math.abs(a.value - (consensus ?? 0)) - Math.abs(b.value - (consensus ?? 0)),
      )[0];
      const minValue = Math.min(...values.map((item) => item.value));
      const maxValue = Math.max(...values.map((item) => item.value));
      const timeLabel = index === 0 ? translate("common.now") : formatHour(point.time);
      const summary = `${timeLabel} · ${translate("hourly.consensus")} ${config.formatValue(
        consensus,
      )} · ${translate("hourly.range")} ${config.formatValue(minValue)}–${config.formatValue(
        maxValue,
      )}`;
      return `<div class="chart-hit" tabindex="0" aria-label="${escapeHtml(
        summary,
      )}" style="left:${((x(index) - margin.left) / plotWidth) * 100}%;width:${(100 / (points.length - 1)).toFixed(
        3,
      )}%">
        <span class="chart-cursor"></span>
        <span class="chart-tip">
          <span class="chart-tip-head"><b>${escapeHtml(timeLabel)}</b><i>${escapeHtml(
            translate("hourly.consensus"),
          )}</i></span>
          <strong>${escapeHtml(config.formatValue(consensus))}</strong>
          <span class="chart-tip-range">${escapeHtml(
            translate("hourly.range"),
          )} <em>${escapeHtml(config.formatValue(minValue))}–${escapeHtml(
            config.formatValue(maxValue),
          )}</em></span>
          ${
            closest
              ? `<span class="chart-tip-source"><i style="background:${closest.source.color}"></i>${escapeHtml(
                  closest.source.shortName,
                )} ${escapeHtml(config.formatValue(closest.value))}</span>`
              : ""
          }
        </span>
      </div>`;
    })
    .join("");

  return `<div class="chart-wrap">
    <div class="chart-plot">
      <svg class="model-chart" viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeHtml(
        `${config.aria} · ${translate("hourly.chartAria")}`,
      )}">
        <defs>
          <linearGradient id="chart-band" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#bfe9db" stop-opacity=".14"/>
            <stop offset="100%" stop-color="#bfe9db" stop-opacity=".035"/>
          </linearGradient>
        </defs>
        ${gridLines}
        <path d="${areaPath(bandTop, bandBottom)}" fill="url(#chart-band)"/>
        ${sourceLines}
        <path d="${consensusPath}" fill="none" stroke="#f5f8fd" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" class="consensus-line"/>
        <circle cx="${x(0)}" cy="${y(consensusValues[0] ?? min).toFixed(1)}" r="4" fill="#f5f8fd" stroke="#0b1220" stroke-width="2"/>
        ${xLabels}
      </svg>
      <div class="chart-hits">${hits}</div>
    </div>
    <div class="chart-legend">
      ${activeSources
        .slice()
        .sort((a, b) => b.influence - a.influence)
        .map(
          (source) =>
            `<span class="legend-item" title="${escapeHtml(source.name)}"><i style="background:${
              source.color
            }"></i>${escapeHtml(source.shortName)} <small>${Math.round(
              source.influence * 100,
            )}%</small></span>`,
        )
        .join("")}
      <span class="legend-item legend-consensus"><i></i>${escapeHtml(
        translate("hourly.consensus"),
      )}</span>
    </div>
  </div>`;
}

export function precipBars(hourly, units = "metric", count = 24, locale = "en") {
  const points = hourly.slice(0, count);
  const max = Math.max(...points.map((point) => point.precipitation ?? 0), 0.5);

  function getShortHour(iso) {
    if (!iso) return "";
    const match = String(iso).match(/T(\d{2}):/);
    if (!match) return "";
    return `${match[1]}h`;
  }

  const h0 = getShortHour(points[0]?.time);
  const h6 = getShortHour(points[6]?.time);
  const h12 = getShortHour(points[12]?.time);
  const h18 = getShortHour(points[18]?.time);
  const h24 = getShortHour(points[points.length - 1]?.time);

  return `<div class="precip-timeline">
    <div class="precip-mini" aria-hidden="true">
      ${points
        .map((point, index) => {
          const value = point.precipitation ?? 0;
          const height = clamp((value / max) * 100, 4, 100);
          return `<span class="${value > 0.05 ? "is-wet" : "is-dry"}" style="--h:${height}%;--i:${index}" title="${escapeHtml(
            formatPrecip(value, units, locale),
          )}"></span>`;
        })
        .join("")}
    </div>
    <div class="precip-hours" aria-hidden="true">
      <span>${escapeHtml(h0)}</span>
      <span>${escapeHtml(h6)}</span>
      <span>${escapeHtml(h12)}</span>
      <span>${escapeHtml(h18)}</span>
      <span>${escapeHtml(h24)}</span>
    </div>
  </div>`;
}

export function windCompass(direction, speed, gust, units, locale, translate) {
  const rotation = Number(direction) || 0;
  const cardinal = compassPoint(direction, locale);
  const west = locale === "fr" ? "O" : "W";
  return `<div class="compass-wrap">
    <svg class="compass" viewBox="0 0 160 160" role="img" aria-label="${escapeHtml(
      `${translate("details.wind")} ${formatWindValue(speed, units, locale)}`,
    )}">
      <circle cx="80" cy="80" r="70" fill="rgba(255,255,255,.015)" stroke="rgba(255,255,255,.07)"/>
      <circle cx="80" cy="80" r="54" fill="none" stroke="rgba(255,255,255,.05)" stroke-dasharray="2 4"/>
      <g class="compass-ticks">
        ${Array.from({ length: 24 }, (_, index) => {
          const angle = (index * 360) / 24;
          const major = index % 6 === 0;
          return `<line x1="80" y1="${major ? 13 : 16}" x2="80" y2="${major ? 23 : 21}" transform="rotate(${angle} 80 80)" stroke="rgba(255,255,255,${
            major ? 0.45 : 0.16
          })" stroke-width="${major ? 1.5 : 1}" stroke-linecap="round"/>`;
        }).join("")}
      </g>
      <g class="compass-labels" fill="rgba(232,241,252,.75)" font-size="9.5" font-weight="700" text-anchor="middle">
        <text x="80" y="36">N</text><text x="130" y="83.5">E</text><text x="80" y="132">S</text><text x="30" y="83.5">${west}</text>
      </g>
      <g transform="rotate(${rotation.toFixed(1)} 80 80)">
        <path d="M80 18 L86 42 L80 37 L74 42 Z" fill="#38bdf8"/>
        <path d="M80 142 L85 120 L80 124 L75 120 Z" fill="rgba(255,255,255,.2)"/>
        <line x1="80" y1="42" x2="80" y2="58" stroke="#38bdf8" stroke-width="1.4" stroke-linecap="round"/>
        <line x1="80" y1="102" x2="80" y2="120" stroke="rgba(255,255,255,.2)" stroke-width="1.4" stroke-linecap="round"/>
      </g>
      <circle cx="80" cy="80" r="21" fill="#080e1a" stroke="rgba(255,255,255,.14)" stroke-width="1.4"/>
      <text x="80" y="84.5" text-anchor="middle" fill="#f4f7fc" font-size="12" font-weight="700" letter-spacing="-.3">${escapeHtml(cardinal)}</text>
    </svg>
    <div class="compass-meta">
      <div><span>${escapeHtml(translate("details.wind"))}</span><strong>${escapeHtml(
        formatWindValue(speed, units, locale),
      )} <small>${units === "imperial" ? "mph" : "km/h"}</small></strong></div>
      <div><span>${escapeHtml(translate("details.gust"))}</span><strong>${escapeHtml(
        formatWindValue(gust, units, locale),
      )} <small>${units === "imperial" ? "mph" : "km/h"}</small></strong></div>
      <div><span>Direction</span><strong>${Math.round(rotation)}°</strong></div>
    </div>
  </div>`;
}

export function uvArc(value, max, locale, translate) {
  const current = clamp(Number(value) || 0, 0, 12);
  const peak = clamp(Number(max) || 0, 0, 12);
  const angle = -90 + (current / 12) * 180;
  const peakAngle = -90 + (peak / 12) * 180;
  const category = uvCategory(current);
  const categoryName = translate(`details.uv${capitalize(category)}`);
  return `<div class="uv-gauge">
    <svg viewBox="0 0 220 134" role="img" aria-label="${escapeHtml(
      `${translate("details.uv")} ${formatNumber(current, locale, {
        minimumFractionDigits: 1,
        maximumFractionDigits: 1,
      })}`,
    )}">
      <defs>
        <linearGradient id="uv-gradient" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stop-color="#34d399"/>
          <stop offset="35%" stop-color="#facc15"/>
          <stop offset="70%" stop-color="#fb923c"/>
          <stop offset="100%" stop-color="#f87171"/>
        </linearGradient>
      </defs>
      <path d="M25 110 A85 85 0 0 1 195 110" fill="none" stroke="rgba(255,255,255,.07)" stroke-width="10" stroke-linecap="round"/>
      <path d="M25 110 A85 85 0 0 1 195 110" fill="none" stroke="url(#uv-gradient)" stroke-width="7.5" stroke-linecap="round" opacity=".95"/>
      <g transform="rotate(${peakAngle.toFixed(1)} 110 110)">
        <line x1="110" y1="18" x2="110" y2="28" stroke="rgba(255,255,255,.5)" stroke-width="1.8" stroke-linecap="round"/>
      </g>
      <g transform="rotate(${angle.toFixed(1)} 110 110)">
        <circle cx="110" cy="25" r="5.5" fill="#ffffff" stroke="#080e1a" stroke-width="2"/>
      </g>
      <text x="110" y="80" text-anchor="middle" fill="#f4f7fc" font-size="30" font-weight="300" letter-spacing="-1">${formatNumber(current, locale, {
        minimumFractionDigits: 1,
        maximumFractionDigits: 1,
      })}</text>
      <text x="110" y="100" text-anchor="middle" fill="#94a3b8" font-size="10.5" font-weight="650" letter-spacing=".5">${escapeHtml(
        categoryName,
      )}</text>
      <text x="25" y="126" text-anchor="middle" fill="rgba(255,255,255,.3)" font-size="8">0</text>
      <text x="110" y="126" text-anchor="middle" fill="rgba(255,255,255,.4)" font-size="8">${escapeHtml(translate("details.uvToday"))} ${formatNumber(peak, locale, {
        minimumFractionDigits: 1,
        maximumFractionDigits: 1,
      })}</text>
      <text x="195" y="126" text-anchor="middle" fill="rgba(255,255,255,.3)" font-size="8">12</text>
    </svg>
  </div>`;
}

export function pressureGauge(pressure, trend, units, locale, translate) {
  const value = clamp(Number(pressure) || 1013, 970, 1050);
  const pct = clamp((value - 970) / (1050 - 970), 0, 1);
  const angle = -120 + pct * 240;
  const trendArrow = trend === "rising" ? "↗" : trend === "falling" ? "↘" : "→";

  return `<div class="pressure-gauge">
    <svg viewBox="0 0 200 138" role="img" aria-label="${escapeHtml(
      `${translate("details.pressure")} ${formatPressure(pressure, units, locale)}`,
    )}">
      <defs>
        <linearGradient id="pressure-grad" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stop-color="#38bdf8"/>
          <stop offset="50%" stop-color="#60a5fa"/>
          <stop offset="100%" stop-color="#818cf8"/>
        </linearGradient>
      </defs>
      <!-- Base track -->
      <path d="M40 120 A68 68 0 1 1 160 120" fill="none" stroke="rgba(255,255,255,.07)" stroke-width="8.5" stroke-linecap="round"/>
      <!-- Active colored pressure arc -->
      <path d="M40 120 A68 68 0 1 1 160 120" fill="none" stroke="url(#pressure-grad)" stroke-width="7" stroke-linecap="round" pathLength="100" stroke-dasharray="100" stroke-dashoffset="${(
        100 - pct * 100
      ).toFixed(1)}" opacity=".92"/>
      <!-- Indicator dot on track -->
      <g transform="rotate(${angle.toFixed(1)} 100 85)">
        <circle cx="100" cy="17" r="5" fill="#ffffff" stroke="#080e1a" stroke-width="2"/>
      </g>
      <!-- Central display -->
      <text x="100" y="80" text-anchor="middle" fill="#f4f7fc" font-size="22" font-weight="400" letter-spacing="-.5">${escapeHtml(
        formatPressure(pressure, units, locale),
      )}</text>
      <text x="100" y="98" text-anchor="middle" fill="#94a3b8" font-size="10" font-weight="600" letter-spacing=".4">${trendArrow} ${escapeHtml(
        translate(`details.${trend}`),
      )}</text>
      <!-- Scale limits -->
      <text x="40" y="132" text-anchor="middle" fill="rgba(255,255,255,.3)" font-size="7.5">970</text>
      <text x="100" y="118" text-anchor="middle" fill="rgba(255,255,255,.2)" font-size="7">1013</text>
      <text x="160" y="132" text-anchor="middle" fill="rgba(255,255,255,.3)" font-size="7.5">1050</text>
    </svg>
  </div>`;
}

export function humidityDrop(value) {
  const pct = clamp(Number(value) || 0, 0, 100);
  return `<div class="humidity-visual" style="--pct:${pct}">
    <svg viewBox="0 0 120 120" aria-hidden="true">
      <defs>
        <clipPath id="drop-clip">
          <path d="M60 12S96 56 96 76a36 36 0 0 1-72 0C24 56 60 12 60 12Z"/>
        </clipPath>
        <linearGradient id="drop-fill" x1="0" y1="1" x2="0" y2="0">
          <stop offset="0%" stop-color="#0284c7"/>
          <stop offset="100%" stop-color="#38bdf8"/>
        </linearGradient>
      </defs>
      <path d="M60 12S96 56 96 76a36 36 0 0 1-72 0C24 56 60 12 60 12Z" fill="rgba(255,255,255,.04)" stroke="rgba(255,255,255,.12)" stroke-width="1.2"/>
      <g clip-path="url(#drop-clip)">
        <rect x="18" y="${(120 - (pct / 100) * 100).toFixed(1)}" width="84" height="110" fill="url(#drop-fill)" opacity=".75"/>
        <path d="M20 87c12-5 21 4 34 0s22-5 33 0 17 3 24 0v30H20Z" fill="#bae6fd" opacity=".25"/>
      </g>
      <text x="60" y="80" text-anchor="middle" fill="#f4f7fc" font-size="19" font-weight="700" letter-spacing="-.5">${Math.round(
        pct,
      )}%</text>
    </svg>
  </div>`;
}

export function visibilityBar(km, units, locale) {
  const value = clamp(Number(km) || 0, 0, 40);
  const pct = value <= 10
    ? (value / 10) * 50
    : 50 + ((value - 10) / 30) * 50;
  return `<div class="visibility-bar">
    <div class="visibility-track"><span style="left:${pct.toFixed(1)}%"></span></div>
    <div class="visibility-labels"><span>0</span><span>${escapeHtml(
      formatVisibility(10, units, locale),
    )}</span><span>${escapeHtml(formatVisibility(40, units, locale))}</span></div>
  </div>`;
}

export function cloudDonut(percent) {
  const value = clamp(Number(percent) || 0, 0, 100);
  const radius = 38;
  const circumference = 2 * Math.PI * radius;
  return `<div class="cloud-donut">
    <svg viewBox="0 0 100 100" aria-hidden="true">
      <circle cx="50" cy="50" r="${radius}" fill="none" stroke="rgba(255,255,255,.07)" stroke-width="7"/>
      <circle cx="50" cy="50" r="${radius}" fill="none" stroke="#c8d6e9" stroke-opacity=".8" stroke-width="7" stroke-linecap="round" stroke-dasharray="${circumference}" stroke-dashoffset="${(
        circumference *
        (1 - value / 100)
      ).toFixed(1)}" transform="rotate(-90 50 50)"/>
    </svg>
    <span><strong>${Math.round(value)}</strong><small>%</small></span>
  </div>`;
}

export function aqiBar(aqi, locale, translate) {
  const value = clamp(Number(aqi) || 0, 0, 120);
  const pct = clamp((value / 100) * 100, 2, 100);
  return `<div class="aqi-bar" role="img" aria-label="${escapeHtml(
    translate("air.aqiScale"),
  )} ${Math.round(value)}">
    <div class="aqi-track"><span style="left:${pct}%"></span></div>
    <div class="aqi-ticks"><span>0</span><span>20</span><span>40</span><span>60</span><span>80</span><span>100+</span></div>
  </div>`;
}

export function sunArc({ sunrise, sunset, nowMinutes, isDay, locale, translate }) {
  const rise = timeToMinutes(sunrise);
  const set = timeToMinutes(sunset);
  const now = Number.isFinite(nowMinutes) ? nowMinutes : rise ?? 0;
  let progress = 0;
  if (rise != null && set != null && set > rise) {
    progress = clamp((now - rise) / (set - rise), 0, 1);
  }
  const start = { x: 24, y: 104 };
  const end = { x: 236, y: 104 };
  const control = { x: 130, y: 14 };
  const point = (t) => ({
    x: (1 - t) ** 2 * start.x + 2 * (1 - t) * t * control.x + t ** 2 * end.x,
    y: (1 - t) ** 2 * start.y + 2 * (1 - t) * t * control.y + t ** 2 * end.y,
  });
  const sun = point(progress);
  return `<div class="sun-arc-wrap">
    <svg viewBox="0 0 260 132" class="sun-arc" role="img" aria-label="${escapeHtml(
      translate("sun.arcLabel"),
    )}">
      <defs>
        <linearGradient id="sun-arc-line" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stop-color="#f0b66a" stop-opacity=".4"/>
          <stop offset="50%" stop-color="#f7d795" stop-opacity=".85"/>
          <stop offset="100%" stop-color="#e9a866" stop-opacity=".4"/>
        </linearGradient>
        <linearGradient id="sun-horizon" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stop-color="rgba(255,255,255,0)"/>
          <stop offset="50%" stop-color="rgba(255,255,255,.18)"/>
          <stop offset="100%" stop-color="rgba(255,255,255,0)"/>
        </linearGradient>
      </defs>
      <path d="M24 104 Q130 8 236 104" fill="none" stroke="rgba(255,255,255,.075)" stroke-width="1.4"/>
      <path d="M24 104 Q130 8 236 104" fill="none" stroke="url(#sun-arc-line)" stroke-width="2.4" pathLength="1" stroke-dasharray="1" stroke-dashoffset="${1 - progress}"/>
      <line x1="14" y1="104" x2="246" y2="104" stroke="url(#sun-horizon)" stroke-width="1"/>
      <g ${isDay ? "" : 'opacity=".5"'}>
        <circle cx="${sun.x.toFixed(1)}" cy="${sun.y.toFixed(1)}" r="17" fill="url(#wx-sun-glow)" opacity=".8"/>
        <circle cx="${sun.x.toFixed(1)}" cy="${sun.y.toFixed(1)}" r="6.2" fill="url(#wx-sun)"/>
      </g>
      <circle cx="24" cy="104" r="2.2" fill="rgba(255,255,255,.45)"/>
      <circle cx="236" cy="104" r="2.2" fill="rgba(255,255,255,.45)"/>
    </svg>
  </div>`;
}

export function nowcastBars(nowcast, units, translate) {
  if (!nowcast.length) {
    return `<div class="nowcast-empty">${uiIcon("droplet", 18)}<span>${escapeHtml(
      translate("nowcast.noData"),
    )}</span></div>`;
  }
  const max = Math.max(...nowcast.map((point) => point.precipitation), 0.2);
  return `<div class="nowcast-bars" role="img" aria-label="${escapeHtml(
    translate("nowcast.chartAria"),
  )}">
    <div class="nowcast-grid"></div>
    ${nowcast
      .map((point, index) => {
        const height = clamp((point.precipitation / max) * 100, point.precipitation > 0 ? 8 : 2, 100);
        return `<div class="nowcast-col">
          <span class="nowcast-value">${point.precipitation > 0 ? escapeHtml(formatPrecip(point.precipitation, units, "en", 2)) : ""}</span>
          <span class="nowcast-bar" style="--h:${height}%;--delay:${index * 45}ms"></span>
          <span class="nowcast-time">${index === 0 ? escapeHtml(translate("common.now")) : escapeHtml(formatHour(point.time))}</span>
        </div>`;
      })
      .join("")}
  </div>`;
}

export function aqiSparkline(values, weather, locale = "en", translate) {
  if (!values || values.length < 2) return "";
  const width = 240;
  const height = 48;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = Math.max(6, max - min);
  const points = values.map((value, index) => ({
    x: (index / (values.length - 1)) * width,
    y: height - 5 - ((value - min) / range) * (height - 12),
  }));
  const line = linePath(points);
  const area = `${line} L${width} ${height} L0 ${height} Z`;

  const tickIndices = [0, 6, 12, 18, Math.min(23, values.length - 1)];
  const tickLabels = tickIndices.map((idx, i) => {
    if (i === 0) return translate ? translate("common.now") : "Maintenant";
    const hourPoint = weather?.hourly?.[idx];
    if (hourPoint?.time) return formatHour(hourPoint.time);
    return `+${idx}h`;
  });

  return `<div class="aqi-spark-wrap">
    <svg class="aqi-spark" viewBox="0 0 ${width} ${height}" aria-hidden="true">
      <path d="${area}" fill="rgba(191,233,219,.07)"/>
      <path d="${line}" fill="none" stroke="#bfe9db" stroke-width="1.5" stroke-linecap="round"/>
      <circle cx="${points[0].x}" cy="${points[0].y}" r="2.4" fill="#bfe9db"/>
    </svg>
    <div class="aqi-spark-labels">
      ${tickLabels.map((lbl) => `<span>${escapeHtml(lbl)}</span>`).join("")}
    </div>
  </div>`;
}

function timeToMinutes(iso) {
  if (!iso) return null;
  const match = String(iso).match(/T(\d{2}):(\d{2})/);
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

function capitalize(value) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
