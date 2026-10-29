import { fetchPrecipitationMap } from "./api.js";
import { escapeHtml, formatHour, formatPrecip } from "./format.js";
import { uiIcon } from "./icons.js";

const ZOOM_MIN = 6;
const ZOOM_MAX = 10;
const DEFAULT_ZOOM = 8;
const TILE_SIZE = 256;
const RAIN_THRESHOLD = 0.1;

const mapState = {
  activeKey: null,
  key: null,
  data: null,
  loading: false,
  loadKey: null,
  error: null,
  frame: 0,
  playing: false,
  timer: null,
  center: null,
  home: null,
  zoom: DEFAULT_ZOOM,
  place: null,
  placeName: "",
  theme: "aurora",
  units: "metric",
  locale: "en",
  tr: null,
  requestSeq: 0,
  dragging: null,
  chipsCount: 0,
};

const boundStages = new WeakSet();
let resizeBound = false;

function translate(key, vars = {}) {
  return mapState.tr ? mapState.tr(key, vars) : key;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function keyFor(place) {
  return `${Number(place.latitude).toFixed(3)},${Number(place.longitude).toFixed(3)}`;
}

function prepare(place, theme) {
  if (theme) mapState.theme = theme;
  const key = keyFor(place);
  if (mapState.activeKey !== key) {
    mapState.activeKey = key;
    mapState.key = null;
    mapState.data = null;
    mapState.loading = false;
    mapState.loadKey = null;
    mapState.error = null;
    mapState.frame = 0;
    mapState.chipsCount = 0;
    mapState.requestSeq += 1;
    mapState.center = { latitude: Number(place.latitude), longitude: Number(place.longitude) };
    mapState.home = { ...mapState.center };
    mapState.zoom = DEFAULT_ZOOM;
    stopPlaying();
  }
  mapState.place = { latitude: Number(place.latitude), longitude: Number(place.longitude) };
  if (!mapState.center) mapState.center = { ...mapState.place };
  if (!mapState.home) mapState.home = { ...mapState.place };
}

/* ------------------------------------------------------------------ */
/* Projection & tiles                                                  */
/* ------------------------------------------------------------------ */

function worldSize(zoom) {
  return TILE_SIZE * 2 ** zoom;
}

function project(latitude, longitude, zoom) {
  const size = worldSize(zoom);
  const lat = clamp(latitude, -85.05112878, 85.05112878);
  const sin = Math.sin((lat * Math.PI) / 180);
  return {
    x: ((longitude + 180) / 360) * size,
    y: (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * size,
  };
}

function unproject(x, y, zoom) {
  const size = worldSize(zoom);
  const n = Math.PI - (2 * Math.PI * y) / size;
  return {
    longitude: (x / size) * 360 - 180,
    latitude: (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n))),
  };
}

function screenPoint(latitude, longitude, width, height, center, zoom) {
  const point = project(latitude, longitude, zoom);
  const origin = project(center.latitude, center.longitude, zoom);
  return {
    x: width / 2 + (point.x - origin.x),
    y: height / 2 + (point.y - origin.y),
  };
}

function tileUrl(zoom, x, y) {
  const style = mapState.theme === "pixel" ? "light_all" : "dark_all";
  const subdomain = ["a", "b", "c"][(x + y) % 3];
  return `https://${subdomain}.basemaps.cartocdn.com/${style}/${zoom}/${x}/${y}.png`;
}

function renderTiles(container, width, height, center, zoom) {
  const origin = project(center.latitude, center.longitude, zoom);
  const topLeft = { x: origin.x - width / 2, y: origin.y - height / 2 };
  const startX = Math.floor(topLeft.x / TILE_SIZE);
  const startY = Math.floor(topLeft.y / TILE_SIZE);
  const endX = Math.floor((topLeft.x + width) / TILE_SIZE);
  const endY = Math.floor((topLeft.y + height) / TILE_SIZE);
  const maxTile = 2 ** zoom;
  const parts = [];
  for (let x = startX; x <= endX; x += 1) {
    for (let y = startY; y <= endY; y += 1) {
      if (y < 0 || y >= maxTile) continue;
      const wrappedX = ((x % maxTile) + maxTile) % maxTile;
      const left = x * TILE_SIZE - topLeft.x;
      const top = y * TILE_SIZE - topLeft.y;
      parts.push(
        `<img src="${tileUrl(zoom, wrappedX, y)}" alt="" draggable="false" decoding="async" style="left:${left.toFixed(1)}px;top:${top.toFixed(1)}px">`,
      );
    }
  }
  container.innerHTML = parts.join("");
}

/* ------------------------------------------------------------------ */
/* Rain overlay                                                        */
/* ------------------------------------------------------------------ */

const RAIN_STOPS = [
  [0.03, [56, 189, 248, 0]],
  [0.1, [56, 189, 248, 72]],
  [0.3, [59, 130, 246, 118]],
  [0.7, [99, 102, 241, 148]],
  [1.4, [168, 85, 247, 164]],
  [2.8, [236, 72, 153, 178]],
  [5, [251, 191, 36, 194]],
];

function rainColor(value) {
  if (!Number.isFinite(value) || value < RAIN_STOPS[0][0]) return [0, 0, 0, 0];
  for (let index = 1; index < RAIN_STOPS.length; index += 1) {
    const [stop, color] = RAIN_STOPS[index];
    const [previousStop, previousColor] = RAIN_STOPS[index - 1];
    if (value <= stop) {
      const ratio = clamp((value - previousStop) / (stop - previousStop), 0, 1);
      return previousColor.map((channel, channelIndex) =>
        Math.round(channel + (color[channelIndex] - channel) * ratio),
      );
    }
  }
  return RAIN_STOPS[RAIN_STOPS.length - 1][1];
}

function drawRain(canvas, width, height, data, frame, center, zoom) {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = Math.max(1, Math.round(width * dpr));
  canvas.height = Math.max(1, Math.round(height * dpr));
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  const context = canvas.getContext("2d");
  if (!context) return;
  context.setTransform(dpr, 0, 0, dpr, 0, 0);
  context.clearRect(0, 0, width, height);
  if (!data || !frame) return;

  const northWest = screenPoint(
    data.bounds.north,
    data.bounds.west,
    width,
    height,
    center,
    zoom,
  );
  const southEast = screenPoint(
    data.bounds.south,
    data.bounds.east,
    width,
    height,
    center,
    zoom,
  );
  const drawWidth = southEast.x - northWest.x;
  const drawHeight = southEast.y - northWest.y;
  if (drawWidth <= 0 || drawHeight <= 0) return;

  const offscreen = document.createElement("canvas");
  offscreen.width = data.cols;
  offscreen.height = data.rows;
  const offscreenContext = offscreen.getContext("2d");
  if (!offscreenContext) return;
  const image = offscreenContext.createImageData(data.cols, data.rows);
  for (let index = 0; index < data.rows * data.cols; index += 1) {
    const [red, green, blue, alpha] = rainColor(frame.values[index] ?? 0);
    const offset = index * 4;
    image.data[offset] = red;
    image.data[offset + 1] = green;
    image.data[offset + 2] = blue;
    image.data[offset + 3] = alpha;
  }
  offscreenContext.putImageData(image, 0, 0);

  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.drawImage(offscreen, northWest.x, northWest.y, drawWidth, drawHeight);
  context.strokeStyle = "rgba(255,255,255,.14)";
  context.lineWidth = 1;
  context.strokeRect(northWest.x, northWest.y, drawWidth, drawHeight);
}

/* ------------------------------------------------------------------ */
/* Markup                                                              */
/* ------------------------------------------------------------------ */

export function precipMapMarkup(weather, options = {}) {
  const { tr, units = "metric", locale = "en", theme, placeName } = options;
  prepare(weather.location, theme);
  mapState.tr = tr || mapState.tr;
  mapState.units = units;
  mapState.locale = locale;
  mapState.placeName = placeName || weather.location.name || "";

  const ready = Boolean(mapState.data && mapState.key === mapState.activeKey);
  const frames = ready ? mapState.data.frames : [];
  const frameIndex = frames.length ? Math.min(mapState.frame, frames.length - 1) : 0;
  const frame = frames[frameIndex] || null;
  mapState.chipsCount = 0;
  const timeLabel = frame
    ? frameIndex === 0
      ? translate("precip.now")
      : formatHour(frame.time, locale)
    : translate("precip.loading");

  return `<section class="card precip-card" id="precip" aria-labelledby="precip-title">
    <div class="card-head">
      <div><p class="eyebrow">${uiIcon("droplet", 12)} ${escapeHtml(
        translate("precip.eyebrow"),
      )}</p><h2 id="precip-title">${escapeHtml(translate("precip.title"))}</h2></div>
      <span class="subtle-pill">${uiIcon("clock", 12)} ${escapeHtml(
        translate("precip.sub"),
      )}</span>
    </div>
    <div class="precip-stage" data-precip-stage>
      <div class="precip-tiles" data-precip-tiles aria-hidden="true"></div>
      <canvas class="precip-canvas" data-precip-canvas aria-hidden="true"></canvas>
      <div class="precip-marker" data-precip-marker aria-hidden="true"><span></span><b>${escapeHtml(
        mapState.placeName,
      )}</b></div>
      <div class="precip-status" data-precip-status></div>
      <div class="precip-controls">
        <button class="precip-control" data-action="precip-zoom-in" aria-label="${escapeHtml(
          translate("precip.zoomIn"),
        )}" title="${escapeHtml(translate("precip.zoomIn"))}">${uiIcon("plus", 15)}</button>
        <button class="precip-control" data-action="precip-zoom-out" aria-label="${escapeHtml(
          translate("precip.zoomOut"),
        )}" title="${escapeHtml(translate("precip.zoomOut"))}">${uiIcon("minus", 15)}</button>
        <button class="precip-control" data-action="precip-recenter" aria-label="${escapeHtml(
          translate("precip.recenter"),
        )}" title="${escapeHtml(translate("precip.recenter"))}">${uiIcon("locate", 15)}</button>
      </div>
      <div class="precip-attribution">${escapeHtml(translate("precip.basemap"))}</div>
    </div>
    <div class="precip-timeline">
      <button class="precip-play" data-action="precip-play" aria-label="${escapeHtml(
        translate("precip.play"),
      )}" disabled>
        <span data-precip-play-icon>${uiIcon("play", 15)}</span>
        <span data-precip-play-label>${escapeHtml(translate("precip.play"))}</span>
      </button>
      <input class="precip-slider" type="range" data-precip-slider min="0" max="0" step="1" value="0" aria-label="${escapeHtml(
        translate("precip.timeline"),
      )}">
      <b class="precip-time" data-precip-time>${escapeHtml(timeLabel)}</b>
    </div>
    <div class="precip-chips" data-precip-chips role="group" aria-label="${escapeHtml(
      translate("precip.timeline"),
    )}"></div>
    <div class="precip-foot">
      <p class="precip-summary" data-precip-summary>${escapeHtml(
        frame ? translate("precip.ready") : translate("precip.loading"),
      )}</p>
      <div class="precip-legend"><span>${escapeHtml(
        translate("precip.legend"),
      )}</span><i class="precip-scale"></i><div><span>0</span><span>0.5</span><span>2</span><span>5+</span></div></div>
    </div>
  </section>`;
}

/* ------------------------------------------------------------------ */
/* Painting                                                            */
/* ------------------------------------------------------------------ */

function chipsMarkup(frames, frameIndex) {
  return frames
    .map((frame, index) => {
      if (index !== 0 && index % 3 !== 0) return "";
      const label = index === 0 ? translate("precip.now") : formatHour(frame.time, mapState.locale);
      return `<button class="precip-chip ${index === frameIndex ? "is-active" : ""}" data-action="precip-hour" data-index="${index}" aria-pressed="${
        index === frameIndex
      }">${escapeHtml(label)}</button>`;
    })
    .join("");
}

function summaryText(data, frameIndex) {
  const frame = data.frames[frameIndex];
  if (!frame) return translate("precip.loading");
  const centerIndex =
    Math.floor((data.rows - 1) / 2) * data.cols + Math.floor((data.cols - 1) / 2);
  const wetIndex = data.frames.findIndex(
    (item, index) => index >= frameIndex && (item.values[centerIndex] ?? 0) >= RAIN_THRESHOLD,
  );
  if (wetIndex >= 0) {
    return translate("precip.summary", {
      place: mapState.placeName,
      time:
        wetIndex === 0
          ? translate("precip.now")
          : formatHour(data.frames[wetIndex].time, mapState.locale),
    });
  }
  if ((frame.max ?? 0) >= RAIN_THRESHOLD) {
    return translate("precip.summaryGrid", {
      time: formatHour(frame.time, mapState.locale),
      value: formatPrecip(frame.max, mapState.units, mapState.locale),
    });
  }
  return translate("precip.dry", { place: mapState.placeName });
}

function positionMarker(marker, width, height, center, zoom) {
  if (!mapState.home) {
    marker.style.display = "none";
    return;
  }
  const point = screenPoint(
    mapState.home.latitude,
    mapState.home.longitude,
    width,
    height,
    center,
    zoom,
  );
  if (point.x < -30 || point.x > width + 30 || point.y < -30 || point.y > height + 30) {
    marker.style.display = "none";
    return;
  }
  marker.style.display = "";
  marker.style.left = `${point.x}px`;
  marker.style.top = `${point.y}px`;
}

function paint() {
  const stage = document.querySelector("[data-precip-stage]");
  if (!stage) return;
  const width = stage.clientWidth || 640;
  const height = stage.clientHeight || 360;
  const ready = Boolean(mapState.data && mapState.key === mapState.activeKey);
  const data = ready ? mapState.data : null;
  const frames = data?.frames ?? [];
  const frameIndex = frames.length ? Math.min(mapState.frame, frames.length - 1) : 0;
  mapState.frame = frameIndex;
  const frame = frames[frameIndex] || null;
  const center = mapState.center || mapState.home || { latitude: 0, longitude: 0 };
  const zoom = mapState.zoom;

  const tiles = stage.querySelector("[data-precip-tiles]");
  if (tiles) renderTiles(tiles, width, height, center, zoom);
  const canvas = stage.querySelector("[data-precip-canvas]");
  if (canvas) drawRain(canvas, width, height, data, frame, center, zoom);
  const marker = stage.querySelector("[data-precip-marker]");
  if (marker) positionMarker(marker, width, height, center, zoom);

  const status = stage.querySelector("[data-precip-status]");
  if (status) {
    status.classList.toggle("is-visible", mapState.loading || Boolean(mapState.error));
    if (mapState.loading) {
      status.innerHTML = `<span class="precip-spinner"></span><span>${escapeHtml(
        translate("precip.loading"),
      )}</span>`;
    } else if (mapState.error) {
      status.innerHTML = `<span>${escapeHtml(
        translate("precip.error"),
      )}</span><button class="button button--ghost button--small" data-action="precip-retry">${uiIcon(
        "refresh",
        13,
      )} ${escapeHtml(translate("precip.retry"))}</button>`;
    } else {
      status.innerHTML = "";
    }
  }

  const playButton = document.querySelector('[data-action="precip-play"]');
  if (playButton) {
    playButton.disabled = !data;
    const icon = playButton.querySelector("[data-precip-play-icon]");
    if (icon) icon.innerHTML = uiIcon(mapState.playing ? "pause" : "play", 15);
    const label = playButton.querySelector("[data-precip-play-label]");
    const playLabel = translate(mapState.playing ? "precip.pause" : "precip.play");
    if (label) label.textContent = playLabel;
    playButton.setAttribute("aria-label", playLabel);
  }

  const slider = document.querySelector("[data-precip-slider]");
  if (slider) {
    slider.max = String(Math.max(0, frames.length - 1));
    slider.value = String(frameIndex);
    slider.disabled = !frames.length;
  }

  const timeLabel = document.querySelector("[data-precip-time]");
  if (timeLabel) {
    timeLabel.textContent = frame
      ? frameIndex === 0
        ? translate("precip.now")
        : formatHour(frame.time, mapState.locale)
      : translate("precip.loading");
  }

  const chips = document.querySelector("[data-precip-chips]");
  if (chips) {
    if (mapState.chipsCount !== frames.length) {
      chips.innerHTML = chipsMarkup(frames, frameIndex);
      mapState.chipsCount = frames.length;
    } else {
      chips.querySelectorAll("[data-index]").forEach((chip) => {
        const index = Number(chip.dataset.index);
        chip.classList.toggle("is-active", index === frameIndex);
        chip.setAttribute("aria-pressed", String(index === frameIndex));
      });
    }
  }

  const summary = document.querySelector("[data-precip-summary]");
  if (summary) {
    summary.textContent = data && frame ? summaryText(data, frameIndex) : translate("precip.loading");
  }
}

/* ------------------------------------------------------------------ */
/* Data loading                                                        */
/* ------------------------------------------------------------------ */

async function ensureData(place) {
  const key = keyFor(place);
  if (mapState.key === key && mapState.data) return;
  if (mapState.loading && mapState.loadKey === key) return;
  const sequence = ++mapState.requestSeq;
  mapState.loading = true;
  mapState.loadKey = key;
  mapState.error = null;
  paint();
  try {
    const payload = await fetchPrecipitationMap(
      Number(place.latitude),
      Number(place.longitude),
    );
    if (sequence !== mapState.requestSeq || mapState.activeKey !== key) return;
    mapState.data = payload;
    mapState.key = key;
    mapState.loading = false;
    mapState.loadKey = null;
    mapState.frame = 0;
    mapState.chipsCount = 0;
    paint();
  } catch (error) {
    if (sequence !== mapState.requestSeq || mapState.activeKey !== key) return;
    mapState.loading = false;
    mapState.loadKey = null;
    mapState.error = error;
    paint();
  }
}

/* ------------------------------------------------------------------ */
/* Interaction                                                         */
/* ------------------------------------------------------------------ */

function stopPlaying() {
  mapState.playing = false;
  if (mapState.timer) {
    clearInterval(mapState.timer);
    mapState.timer = null;
  }
}

export function togglePrecipPlay() {
  if (!mapState.data) return;
  if (mapState.playing) {
    stopPlaying();
    paint();
    return;
  }
  mapState.playing = true;
  mapState.timer = setInterval(() => {
    const frames = mapState.data?.frames ?? [];
    if (!frames.length) {
      stopPlaying();
      paint();
      return;
    }
    mapState.frame = (mapState.frame + 1) % frames.length;
    paint();
  }, 1100);
  paint();
}

export function setPrecipFrame(index) {
  const frames = mapState.data?.frames ?? [];
  if (!frames.length) return;
  stopPlaying();
  mapState.frame = clamp(Math.round(Number(index) || 0), 0, frames.length - 1);
  paint();
}

export function zoomPrecip(delta) {
  mapState.zoom = clamp(mapState.zoom + delta, ZOOM_MIN, ZOOM_MAX);
  paint();
}

export function recenterPrecip() {
  if (!mapState.home) return;
  mapState.center = { ...mapState.home };
  mapState.zoom = DEFAULT_ZOOM;
  paint();
}

export function retryPrecip() {
  if (!mapState.place) return;
  mapState.key = null;
  mapState.data = null;
  mapState.error = null;
  ensureData(mapState.place);
}

export function handlePrecipInput(target) {
  if (!target?.matches?.("[data-precip-slider]")) return false;
  setPrecipFrame(Number(target.value));
  return true;
}

function bindStage(stage) {
  if (boundStages.has(stage)) return;
  boundStages.add(stage);

  stage.addEventListener("pointerdown", (event) => {
    if (event.target.closest("button, input, a")) return;
    mapState.dragging = {
      x: event.clientX,
      y: event.clientY,
      center: { ...(mapState.center || mapState.home) },
    };
    stage.classList.add("is-dragging");
    try {
      stage.setPointerCapture(event.pointerId);
    } catch {
      /* Pointer capture is optional. */
    }
  });

  stage.addEventListener("pointermove", (event) => {
    const drag = mapState.dragging;
    if (!drag) return;
    const origin = project(drag.center.latitude, drag.center.longitude, mapState.zoom);
    const next = unproject(
      origin.x - (event.clientX - drag.x),
      origin.y - (event.clientY - drag.y),
      mapState.zoom,
    );
    mapState.center = {
      latitude: clamp(next.latitude, -80, 80),
      longitude: next.longitude,
    };
    paint();
  });

  const endDrag = () => {
    mapState.dragging = null;
    stage.classList.remove("is-dragging");
  };
  stage.addEventListener("pointerup", endDrag);
  stage.addEventListener("pointercancel", endDrag);
  stage.addEventListener("pointerleave", (event) => {
    if (event.buttons === 0) endDrag();
  });

  stage.addEventListener(
    "wheel",
    (event) => {
      if (Math.abs(event.deltaY) < 1) return;
      event.preventDefault();
      zoomPrecip(event.deltaY > 0 ? -1 : 1);
    },
    { passive: false },
  );
}

export function initPrecipMap(options = {}) {
  const { weather, tr, units = "metric", locale = "en", theme, placeName } = options;
  if (!weather?.location) return;
  prepare(weather.location, theme);
  mapState.tr = tr || mapState.tr;
  mapState.units = units;
  mapState.locale = locale;
  mapState.placeName = placeName || weather.location.name || "";

  const stage = document.querySelector("[data-precip-stage]");
  if (!stage) return;
  bindStage(stage);
  paint();
  requestAnimationFrame(paint);
  ensureData(weather.location);

  if (!resizeBound) {
    resizeBound = true;
    window.addEventListener("resize", () => paint());
  }
}
