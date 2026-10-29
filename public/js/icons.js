import { clamp, weatherInfo } from "./format.js";

const UI_PATHS = {
  search: '<circle cx="11" cy="11" r="7.2"/><path d="M16.4 16.4 21 21"/>',
  settings:
    '<path d="M4 6h8M16 6h4M4 12h3M11 12h9M4 18h10M18 18h2"/><circle cx="14" cy="6" r="2"/><circle cx="9" cy="12" r="2"/><circle cx="16" cy="18" r="2"/>',
  refresh:
    '<path d="M20.5 12a8.5 8.5 0 1 1-2.5-6"/><path d="M20.5 3.5V9H15"/>',
  pin: '<path d="M12 21s7-6.2 7-12a7 7 0 1 0-14 0c0 5.8 7 12 7 12Z"/><circle cx="12" cy="9" r="2.4"/>',
  crosshair:
    '<circle cx="12" cy="12" r="6.8"/><path d="M12 2.5v4M12 17.5v4M2.5 12h4M17.5 12h4"/>',
  star: '<path d="m12 3 2.65 5.38 5.94.86-4.3 4.19 1.02 5.91L12 16.55l-5.31 2.79 1.02-5.91-4.3-4.19 5.94-.86Z"/>',
  x: '<path d="m6 6 12 12M18 6 6 18"/>',
  chevronDown: '<path d="m6 9 6 6 6-6"/>',
  chevronUp: '<path d="m18 15-6-6-6 6"/>',
  chevronRight: '<path d="m9 6 6 6-6 6"/>',
  chevronLeft: '<path d="m15 18-6-6 6-6"/>',
  arrowLeft: '<path d="M19 12H5M11 18l-6-6 6-6"/>',
  arrowRight: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  arrowUpRight: '<path d="M7 17 17 7M8 7h9v9"/>',
  sparkles:
    '<path d="M12 3.5c.6 4.2 2.3 5.9 6.5 6.5-4.2.6-5.9 2.3-6.5 6.5-.6-4.2-2.3-5.9-6.5-6.5 4.2-.6 5.9-2.3 6.5-6.5Z"/><path d="M19 15.5c.3 2 1.1 2.8 3 3-1.9.3-2.7 1.1-3 3-.3-1.9-1.1-2.7-3-3 1.9-.2 2.7-1 3-3Z"/>',
  wind: '<path d="M3 8h11.5a2.8 2.8 0 1 0-2.7-3.5M3 12h16a2.5 2.5 0 1 1-2.4 3.2M3 16h7.5a2.4 2.4 0 1 1-2.3 3"/>',
  droplet: '<path d="M12 3.2s6.1 6.3 6.1 10.5a6.1 6.1 0 0 1-12.2 0C5.9 9.5 12 3.2 12 3.2Z"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5.3 5.3l1.6 1.6M17.1 17.1l1.6 1.6M18.7 5.3l-1.6 1.6M6.9 17.1l-1.6 1.6"/>',
  moon: '<path d="M20.2 14.7A8.4 8.4 0 0 1 9.3 3.8a8.7 8.7 0 1 0 10.9 10.9Z"/>',
  cloud: '<path d="M6.5 18.5h11a4.2 4.2 0 0 0 .5-8.4A6.7 6.7 0 0 0 5.3 9a4.8 4.8 0 0 0 1.2 9.5Z"/>',
  eye: '<path d="M2.5 12s3.5-6.3 9.5-6.3S21.5 12 21.5 12s-3.5 6.3-9.5 6.3S2.5 12 2.5 12Z"/><circle cx="12" cy="12" r="2.7"/>',
  gauge: '<path d="M5 19a8 8 0 1 1 14 0"/><path d="m12 12 4-4"/><circle cx="12" cy="12" r="1.4"/>',
  compass: '<circle cx="12" cy="12" r="8.5"/><path d="m15.6 8.4-2.1 5.1-5.1 2.1 2.1-5.1Z"/>',
  umbrella: '<path d="M12 3.2c4.6 0 8.4 3.3 8.8 7.8H3.2A8.8 8.8 0 0 1 12 3.2Z"/><path d="M12 11v6.7a2.4 2.4 0 0 0 4.8 0"/>',
  thermometer: '<path d="M9 14.7V5.5a3 3 0 1 1 6 0v9.2a5.5 5.5 0 1 1-6 0Z"/><path d="M12 8.5v8"/>',
  leaf: '<path d="M20 4.5C10.5 4.5 4.5 8.7 4.5 15A4.5 4.5 0 0 0 9 19.5c6.3 0 10.5-6 10.5-15Z"/><path d="M4.5 20c2.6-5.2 6.2-8.8 11.4-11.4"/>',
  alert: '<path d="M10.3 3.8 2.4 17.5A2 2 0 0 0 4.1 20h15.8a2 2 0 0 0 1.7-2.5L13.7 3.8a2 2 0 0 0-3.4 0Z"/><path d="M12 9v4M12 16.8v.2"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 10.5V17M12 7.3v.2"/>',
  layers: '<path d="m12 3 9 5-9 5-9-5 9-5Z"/><path d="m3.5 12.5 8.5 4.7 8.5-4.7M3.5 16.5l8.5 4.7 8.5-4.7"/>',
  clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
  calendar: '<rect x="3.5" y="5" width="17" height="15.5" rx="3"/><path d="M8 3v4M16 3v4M3.5 10h17"/>',
  activity: '<path d="M3 12h4l2.4-6 4.2 12 2.4-6h5"/>',
  waves: '<path d="M3 8c2.2 0 2.2 2 4.5 2S9.7 8 12 8s2.2 2 4.5 2S18.7 8 21 8M3 14c2.2 0 2.2 2 4.5 2s2.2-2 4.5-2 2.2 2 4.5 2 2.2-2 4.5-2"/>',
  sunrise:
    '<path d="M3 18h18M6 18a6 6 0 0 1 12 0"/><path d="M12 3v4M5.6 7.6l1.8 1.8M18.4 7.6l-1.8 1.8M2 14h3M19 14h3"/>',
  sunset:
    '<path d="M3 18h18M6 18a6 6 0 0 1 12 0"/><path d="M12 3v5M9.5 5.5 12 8l2.5-2.5M2 14h3M19 14h3"/>',
  globe: '<circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17M12 3.5c2.5 2.4 3.7 5.2 3.7 8.5s-1.2 6.1-3.7 8.5c-2.5-2.4-3.7-5.2-3.7-8.5S9.5 5.9 12 3.5Z"/>',
  motion: '<path d="M4 8h8M4 12h12M4 16h6"/><path d="M17 6.5a5 5 0 0 1 0 11"/><path d="M19 4a8.5 8.5 0 0 1 0 16"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  minus: '<path d="M5 12h14"/>',
  play: '<path d="M8 5.5v13l10-6.5Z" fill="currentColor" stroke="none"/>',
  pause: '<path d="M8 5.5v13M16 5.5v13" stroke-width="2.4"/>',
  download: '<path d="M12 3.5v11M7.5 10.5 12 15l4.5-4.5"/><path d="M4.5 17.5v2a1 1 0 0 0 1 1h13a1 1 0 0 0 1-1v-2"/>',
  database:
    '<ellipse cx="12" cy="6" rx="7.5" ry="3"/><path d="M4.5 6v6c0 1.7 3.4 3 7.5 3s7.5-1.3 7.5-3V6"/><path d="M4.5 12v6c0 1.7 3.4 3 7.5 3s7.5-1.3 7.5-3v-6"/>',
  check: '<path d="m4.5 12.5 5 5 10-11"/>',
  external: '<path d="M14 4h6v6M20 4 10 14"/><path d="M18 14v4.5a2 2 0 0 1-2 2H5.5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2H10"/>',
  copy: '<rect x="8" y="8" width="12" height="12" rx="2.5"/><path d="M16 8V5.5a2 2 0 0 0-2-2H5.5a2 2 0 0 0-2 2V14a2 2 0 0 0 2 2H8"/>',
  locate:
    '<circle cx="12" cy="12" r="3"/><circle cx="12" cy="12" r="7.5"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/>',
  sliders: '<path d="M4 7h16M4 17h16"/><circle cx="9" cy="7" r="2.2"/><circle cx="15" cy="17" r="2.2"/>',
  flag: '<path d="M5 21V4.5M5 4.5c4-2.2 7 2.2 11 0v8c-4 2.2-7-2.2-11 0"/>',
  trash: '<path d="M4 7h16M9 7V4h6v3M6 7l.8 13h10.4L18 7M10 11v5M14 11v5"/>',
  dot: '<circle cx="12" cy="12" r="3" fill="currentColor" stroke="none"/>',
};

export function uiIcon(name, size = 20, className = "") {
  const content = UI_PATHS[name] ?? UI_PATHS.info;
  return `<svg class="ui-icon ${className}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${content}</svg>`;
}

let glyphId = 0;

function sun({ cx = 60, cy = 55, r = 23, rays = true, opacity = 1 } = {}) {
  const rayMarkup = rays
    ? `<g stroke="#f4cf86" stroke-width="2.3" stroke-linecap="round" opacity=".72">
        <path d="M${cx} ${cy - r - 7}v-7"/>
        <path d="M${cx} ${cy + r + 7}v7"/>
        <path d="M${cx - r - 7} ${cy}h-7"/>
        <path d="M${cx + r + 7} ${cy}h7"/>
        <path d="m${cx - r - 5} ${cy - r - 5}-5-5"/>
        <path d="m${cx + r + 5} ${cy + r + 5} 5 5"/>
        <path d="m${cx + r + 5} ${cy - r - 5} 5-5"/>
        <path d="m${cx - r - 5} ${cy + r + 5}-5 5"/>
      </g>`
    : "";
  return `${rayMarkup}
    <circle cx="${cx}" cy="${cy}" r="${r + 15}" fill="url(#wx-sun-glow)" opacity="${0.7 * opacity}"/>
    <circle cx="${cx}" cy="${cy}" r="${r}" fill="url(#wx-sun)"/>`;
}

function moon({ cx = 64, cy = 53, r = 22, mask = true } = {}) {
  if (!mask) {
    return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="url(#wx-moon)"/>`;
  }
  const id = `moon-${++glyphId}`;
  return `<mask id="${id}">
      <rect x="0" y="0" width="120" height="120" fill="black"/>
      <circle cx="${cx}" cy="${cy}" r="${r}" fill="white"/>
      <circle cx="${cx + r * 0.62}" cy="${cy - r * 0.22}" r="${r * 0.93}" fill="black"/>
    </mask>
    <circle cx="${cx}" cy="${cy}" r="${r + 13}" fill="#dce7f9" opacity=".08"/>
    <circle cx="${cx}" cy="${cy}" r="${r}" fill="url(#wx-moon)" mask="url(#${id})"/>
    <g fill="#f4f0df">
      <circle cx="34" cy="30" r="1.4" opacity=".8"/>
      <circle cx="88" cy="82" r="1.1" opacity=".55"/>
      <circle cx="81" cy="26" r=".9" opacity=".7"/>
    </g>`;
}

function cloudPath(fill = "url(#wx-cloud)", transform = "", opacity = 1) {
  return `<path transform="${transform}" opacity="${opacity}" d="M35.5 84c-11.2 0-20.2-8.7-20.2-19.4 0-10.2 8.1-18.6 18.7-19.5C36.5 34.8 46.5 27 58.4 27c12.5 0 22.9 9.2 24.8 21.2 9 .6 16.1 7.8 16.1 17.1 0 9.6-8 17.7-18 17.7H35.5Z" fill="${fill}"/>`;
}

function cloud({ back = false, transform = "", opacity = 1 } = {}) {
  return `${back ? cloudPath("url(#wx-cloud-back)", "translate(15 -7) scale(.88)", 0.58) : ""}
    ${cloudPath("url(#wx-cloud)", transform, opacity)}
    <path d="M43 65.5c2.3-8.4 9.8-14.2 18.7-14.2 7.4 0 13.9 4.1 17 10.3" stroke="rgba(255,255,255,.58)" stroke-width="2.2" stroke-linecap="round" fill="none"/>`;
}

function rainDrops({ count = 4, heavy = false } = {}) {
  const xs = count === 3 ? [44, 59, 74] : [40, 55, 70, 84];
  return `<g stroke="url(#wx-rain)" stroke-linecap="round">
    ${xs
      .map(
        (x, index) =>
          `<path d="M${x} ${heavy ? 91 : 92}l-${heavy ? 4 : 3} ${heavy ? 14 : 8 + (index % 2) * 3}" stroke-width="${heavy ? 3.8 : 3.1}"/>`,
      )
      .join("")}
  </g>
  <g fill="#b6d8ff" opacity=".6">
    <circle cx="35" cy="108" r="1.1"/><circle cx="53" cy="110" r=".9"/>
    <circle cx="72" cy="108" r="1.1"/><circle cx="89" cy="105" r=".8"/>
  </g>`;
}

function snowflakes() {
  const flake = (x, y, scale = 1) =>
    `<g transform="translate(${x} ${y}) scale(${scale})" stroke="#d8e8fb" stroke-width="1.8" stroke-linecap="round">
      <path d="M0-6V6M-5.2-3 5.2 3M-5.2 3 5.2-3"/>
    </g>`;
  return `${flake(42, 100)}${flake(60, 107, 1.15)}${flake(80, 99, 0.9)}`;
}

function bolt() {
  return `<path d="M62 82 50 102h9l-5 15 20-25h-10l7-10Z" fill="url(#wx-bolt)" stroke="#f8cf7a" stroke-width="1.2" stroke-linejoin="round"/>`;
}

function fogLines() {
  return `<g stroke="#b9cbe2" stroke-width="3" stroke-linecap="round" opacity=".52">
    <path d="M31 94h44"/><path d="M46 103h43"/><path d="M28 112h34"/>
  </g>`;
}

const GLYPH_DEFS = `<defs>
  <radialGradient id="wx-sun" cx="38%" cy="34%" r="72%">
    <stop offset="0%" stop-color="#fff6d8" />
    <stop offset="48%" stop-color="#f8d187" />
    <stop offset="100%" stop-color="#e8a94f" />
  </radialGradient>
  <radialGradient id="wx-sun-glow" cx="50%" cy="50%" r="50%">
    <stop offset="0%" stop-color="#f7cd83" stop-opacity=".5" />
    <stop offset="100%" stop-color="#f7cd83" stop-opacity="0" />
  </radialGradient>
  <linearGradient id="wx-moon" x1="20%" y1="5%" x2="80%" y2="95%">
    <stop offset="0%" stop-color="#fbf7ea" />
    <stop offset="60%" stop-color="#dfe5ee" />
    <stop offset="100%" stop-color="#aebed8" />
  </linearGradient>
  <linearGradient id="wx-cloud" x1="18%" y1="8%" x2="82%" y2="96%">
    <stop offset="0%" stop-color="#fbfdff" />
    <stop offset="45%" stop-color="#dbe5f4" />
    <stop offset="100%" stop-color="#9fb2cf" />
  </linearGradient>
  <linearGradient id="wx-cloud-back" x1="18%" y1="8%" x2="82%" y2="96%">
    <stop offset="0%" stop-color="#bccbe1" />
    <stop offset="100%" stop-color="#7185a6" />
  </linearGradient>
  <linearGradient id="wx-rain" x1="0%" y1="0%" x2="0%" y2="100%">
    <stop offset="0%" stop-color="#a7d4ff" />
    <stop offset="100%" stop-color="#5f9ce8" />
  </linearGradient>
  <linearGradient id="wx-bolt" x1="0%" y1="0%" x2="80%" y2="100%">
    <stop offset="0%" stop-color="#ffe2a1" />
    <stop offset="100%" stop-color="#f4b64f" />
  </linearGradient>
</defs>`;

export function weatherGlyph(code, isDay, size = "md", className = "", label = "") {
  const info = weatherInfo(code);
  const group = info.group;
  let art = "";

  if (group === "clear") {
    art = isDay
      ? `${sun({ cx: 60, cy: 56, r: 27 })}
         ${info.key === "mainlyClear" ? `<g opacity=".55">${cloudPath("url(#wx-cloud)", "translate(35 25) scale(.44)", 0.5)}</g>` : ""}`
      : moon({ cx: 60, cy: 54, r: 25 });
  } else if (group === "partly") {
    art = `${isDay ? sun({ cx: 76, cy: 38, r: 17, rays: true }) : moon({ cx: 77, cy: 37, r: 16 })}
      ${cloud({ transform: "translate(-4 8)" })}`;
  } else if (group === "cloudy") {
    art = `${cloud({ back: true, transform: "translate(3 4)" })}${cloud({ transform: "translate(-3 1)" })}`;
  } else if (group === "fog") {
    art = `${cloud({ transform: "translate(0 -6) scale(.98)" })}${fogLines()}`;
  } else if (group === "drizzle") {
    art = `${cloud({ transform: "translate(0 -5)" })}
      <g stroke="url(#wx-rain)" stroke-width="2.6" stroke-linecap="round" opacity=".9">
        <path d="m42 92-2 6M58 92l-2 8M74 92l-2 6"/>
      </g>`;
  } else if (group === "rain") {
    art = `${cloud({ back: true, transform: "translate(1 -4)" })}${cloud({ transform: "translate(0 -5)" })}${rainDrops({
      count: info.severity >= 13 ? 4 : 3,
      heavy: info.severity >= 13,
    })}`;
  } else if (group === "snow") {
    art = `${cloud({ transform: "translate(0 -5)" })}${snowflakes()}`;
  } else if (group === "thunder") {
    art = `${cloud({ back: true, transform: "translate(2 -5)", opacity: 0.75 })}${cloud({ transform: "translate(0 -6)" })}${bolt()}`;
  }

  const sizeClass = size ? `wx-glyph--${size}` : "";
  return `<span class="wx-glyph ${sizeClass} ${className}" role="img" aria-label="${label}">
    <svg viewBox="0 0 120 122" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">${GLYPH_DEFS}${art}</svg>
  </span>`;
}

export function brandMark(size = 26) {
  const height = Math.round((size * 9) / 8);
  return `<svg class="brand-mark" width="${size}" height="${height}" viewBox="128 36 256 288" fill="none" aria-hidden="true" focusable="false">
    <defs>
      <linearGradient id="nav-sun" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#fde047" />
        <stop offset="100%" stop-color="#f97316" />
      </linearGradient>
      <linearGradient id="nav-cloud" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#38bdf8" />
        <stop offset="100%" stop-color="#0284c7" />
      </linearGradient>
      <clipPath id="bm-shield-clip">
        <path d="M 256 48 L 372 92 V 185 C 372 257 321 296 256 314 C 191 296 140 257 140 185 V 92 Z" />
      </clipPath>
    </defs>
    <!-- Bouclier tech fond -->
    <path d="M 256 48 L 372 92 V 185 C 372 257 321 296 256 314 C 191 296 140 257 140 185 V 92 Z" fill="#0f172a" />
    
    <!-- Contenu météo protégé contre tout débordement -->
    <g clip-path="url(#bm-shield-clip)">
      <circle cx="292" cy="142" r="43" fill="url(#nav-sun)" />
      <path d="M 195 228 A 32.5 32.5 0 0 1 195 163 A 58 58 0 0 1 306 149 A 40 40 0 0 1 321 228 Z" fill="url(#nav-cloud)" />
      <path d="M 267 181 L 231 232 L 256 232 L 242 282 L 288 217 L 260 217 Z" fill="#facc15" />
    </g>

    <!-- Bordure du bouclier au premier plan -->
    <path d="M 256 48 L 372 92 V 185 C 372 257 321 296 256 314 C 191 296 140 257 140 185 V 92 Z" fill="none" stroke="#38bdf8" stroke-width="9" stroke-linejoin="round" />
  </svg>`;
}

export function agreementRing(percent, size = 76, color = "#bfe9db") {
  const value = clamp(Math.round(percent || 0), 0, 100);
  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - value / 100);
  return `<div class="agreement-ring" style="--ring-size:${size}px;--ring-color:${color}">
    <svg viewBox="0 0 100 100" aria-hidden="true">
      <circle class="ring-track" cx="50" cy="50" r="${radius}"/>
      <circle class="ring-value" cx="50" cy="50" r="${radius}" stroke-dasharray="${circumference.toFixed(
        2,
      )}" stroke-dashoffset="${offset.toFixed(2)}"/>
    </svg>
    <span class="ring-label"><strong>${value}</strong><small>%</small></span>
  </div>`;
}

export function moonIcon(phase, illumination, size = 54) {
  const p = Number(phase) || 0;
  const lit = clamp(Number(illumination) || 0, 0, 100);
  const radius = 18;
  const offset = (1 - lit / 100) * radius * 2;
  const shadowX = p <= 0.5 ? 22 - offset : 22 + offset;
  return `<svg class="moon-icon" width="${size}" height="${size}" viewBox="0 0 44 44" aria-hidden="true" focusable="false">
    <circle cx="22" cy="22" r="17" fill="url(#wx-moon)" opacity=".92"/>
    <circle cx="${shadowX.toFixed(2)}" cy="21" r="${radius}" fill="#0b1322"/>
    <g fill="#8d9db7" opacity=".23">
      <circle cx="16" cy="17" r="2.3"/><circle cx="27" cy="27" r="3.1"/><circle cx="17" cy="29" r="1.4"/>
    </g>
    <circle cx="22" cy="22" r="17" fill="none" stroke="rgba(255,255,255,.14)"/>
  </svg>`;
}

export function modelGlyph(size = 18) {
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">
    <circle cx="12" cy="12" r="2.4" fill="currentColor"/>
    <ellipse cx="12" cy="12" rx="9" ry="4.4" stroke="currentColor" stroke-width="1.25" opacity=".75"/>
    <ellipse cx="12" cy="12" rx="9" ry="4.4" stroke="currentColor" stroke-width="1.25" opacity=".45" transform="rotate(60 12 12)"/>
    <ellipse cx="12" cy="12" rx="9" ry="4.4" stroke="currentColor" stroke-width="1.25" opacity=".3" transform="rotate(120 12 12)"/>
  </svg>`;
}

export function advisoryIcon(type, size = 18) {
  const names = {
    wind: "wind",
    rain: "umbrella",
    uv: "sun",
    heat: "thermometer",
    cold: "thermometer",
    ice: "alert",
    thunder: "alert",
    air: "leaf",
  };
  return uiIcon(names[type] ?? "alert", size);
}
