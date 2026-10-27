# DFWMeteo

**Twelve skies. One forecast.**

DFWMeteo is a premium, independent weather app that resolves twelve numerical weather
models into one calm, explainable forecast. It is calibrated for Belgium first and
works for any location worldwide through Open-Meteo's open model infrastructure.

![DFWMeteo desktop preview](docs/preview.png)

## What it does

- **Multi-source consensus** — ECMWF IFS, DWD ICON, UK Met Office, Météo-France,
  KNMI Harmonie, MET Norway, DMI, BOM ACCESS-G, NOAA GFS, ECCC GEM, JMA and CMA GRAPES
  are fetched in parallel for the same coordinates and time zone.
- **Belgium-first weighting** — regional priors favour ultra-high-resolution European
  models (KNMI 2.5 km, AROME 1.3 km, ICON 2 km) around the North Sea, then adapt by country and continent.
- **Official Belgian layer (IRM / KMI)** — for Belgian locations, an IRM observation and
  forecast is shown as a distinct official check. It is deliberately kept outside
  the numerical-model consensus.
  - **Android APK**: Native direct fetch via `CapacitorHttp` with zero CORS limits.
  - **Local server**: Real-time queries for exact coordinates with 10-minute caching.
  - **Web / PWA**: Live gateway with instant fallback to a 34-city regional hub snapshot.
- **Transparent confidence** — weighted temperature consensus, circular wind
  means, weighted weather-code voting, model spread and agreement scores are
  exposed rather than hidden behind a single number.
- **Complete forecast surface** — current conditions, editorial brief,
  24-hour timeline, interactive twelve-model spread chart, 10-day outlook with
  source-by-source daily detail, 15-minute high-resolution nowcast, air quality,
  pollen, sun, moon, UV, visibility, humidity, pressure and smart advisories.
- **Installable Android App & PWA** — Capacitor 8 native APK with hardware back button
  support, service worker shell caching, and automated GitHub Releases.
- **Trilingual** — English, French and Dutch interfaces with localized dates,
  numbers, weather descriptions and briefings.
- **Premium dark interface** — aurora/observatory aesthetic, custom SVG
  weather glyphs, animated atmosphere, responsive layouts, centred mobile detail
  tiles and reduced-motion mode.

<p align="center">
  <img src="docs/mobile.png" width="300" alt="DFWMeteo mobile preview" />
  <img src="docs/details-mobile.png" width="300" alt="Centred detail tiles on mobile" />
</p>

## Android App (APK)

An installable Android APK is automatically built and published to GitHub Releases:

1. Open the [Releases](https://github.com/DualsFWShield/DFWMeteo/releases) tab.
2. Download `DFWMeteo.apk`.
3. Install and run directly on any Android device (supports Android 8.0 up to Android 16 / API 36).

To build the APK locally:

```bash
npm run build
npx cap sync android
cd android
./gradlew assembleDebug
```

The APK will be generated at `android/app/build/outputs/apk/debug/app-debug.apk`.

## Run it locally

Requires **Node.js 22.18+** (Node 24+ recommended). Local mode needs no API key.

```bash
npm install
npm run dev
```

Open <http://127.0.0.1:5173>. The local Express server fetches the twelve models,
serves the app, and queries IRM/KMI live for Belgian locations.

For a production-like local run:

```bash
npm start
```

The app uses `PORT` if set (default 5173). The server binds to `127.0.0.1`.

## Deploy to GitHub Pages

GitHub Pages is static, so DFWMeteo ships a browser build of its consensus engine.
It calls Open-Meteo, Open-Meteo geocoding and BigDataCloud directly, and loads a
build-time IRM/KMI snapshot for 34 Belgian centres across all 10 provinces.

1. Push this repository to GitHub (`main` or `master`).
2. Under **Settings → Pages → Build and deployment**, set **Source** to **GitHub Actions**.
3. Push to `main` (or trigger **Deploy DFWMeteo to GitHub Pages** manually).

The workflow at [`.github/workflows/pages.yml`](.github/workflows/pages.yml)
runs the typecheck, compiles `dist/`, fetches the 34-city IRM snapshot, and deploys the
artifact. It also runs every 30 minutes to refresh the official Belgian layer.

To preview the exact static artifact locally:

```bash
npm run preview
```

This builds `dist/` and serves it at <http://127.0.0.1:4173>.

## Tests & checks

```bash
npm test          # consensus math, weather-code voting, confidence
npm run typecheck # TypeScript server/IRM check
npm run test:api  # live Brussels 12-model aggregation smoke test
npm run build     # typecheck + static GitHub Pages build
node scripts/check-i18n.mjs
```

The browser app is dependency-free at runtime. Fonts are bundled locally, so the interface does not
depend on external CDNs or Google Fonts.

## The 12 Consensus Models

| Model | Center | Resolution / Region | Focus |
| :--- | :--- | :--- | :--- |
| **KNMI Harmonie** | KNMI (Netherlands) | 2.5 km Benelux | Local convective and North Sea boundary |
| **ECMWF IFS** | ECMWF | 0.25° Global | Flagship European global model |
| **ICON** | DWD (Germany) | 2–11 km Europe & Global | High-resolution continental core |
| **UK Met Office** | UKMO (United Kingdom) | 2–10 km | Atlantic frontal dynamics |
| **Météo-France** | Météo-France | 1.3–25 km | High-resolution AROME / ARPEGE |
| **MET Norway** | MET Norway | 1–2.5 km Europe | Nordic and coastal precipitation |
| **DMI** | DMI (Denmark) | 2.5 km Europe | Maritime North Sea / Baltic |
| **BOM ACCESS-G** | BOM (Australia) | 12 km Global | Southern hemisphere / global synthesis |
| **NOAA GFS** | NOAA (United States) | 3–13 km | Global prediction & American core |
| **ECCC GEM** | ECCC (Canada) | 2.5–10 km | High-latitude boreal dynamics |
| **JMA GSM** | JMA (Japan) | 5–20 km | Asian and Pacific spectral model |
| **CMA GRAPES** | CMA (China) | 0.25° Global | Global prediction system |

## Data & attribution

Forecasts and air quality are provided by [Open-Meteo](https://open-meteo.com/)
and its upstream model centres. Model data is © Open-Meteo contributors, licensed under
[CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). DFWMeteo's interface,
weighting, IRM parser and synthesis are independent.

DFWMeteo is **not** an official warning service. For official Belgian alerts, consult
[KMI/IRM](https://www.meteo.be/).

## Architecture

- `server/` — Express API, upstream fetch/caching, 12-model consensus engine, and IRM live service.
- `src-static/static-api.ts` — Browser entry that bundles the consensus engine and Capacitor plugins into `dist/js/dfwmeteo-api.js`.
- `public/` — Dependency-free browser client, custom SVG charts and visual system.
- `android/` — Native Capacitor 8 Android project targeting API 36 with hardware back button listener.
- `shared/` — TypeScript interfaces, types and WMO weather codes.
- `scripts/` — Build tools, IRM 34-centre snapshot fetcher, consensus tests, and i18n validator.
- `.github/workflows/` — `build-apk.yml` (Android release) and `pages.yml` (GitHub Pages deploy).
