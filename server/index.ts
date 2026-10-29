import compression from "compression";
import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { geocode, reverseGeocode } from "./geocode.ts";
import { getIrmOfficial, isBelgiumCoordinate } from "./irm.ts";
import { getPrecipMap } from "./precip-map.ts";
import { getWeather } from "./weather.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const publicDir = path.join(root, "public");
const isDev = process.argv.includes("--dev");
const port = Number(process.env.PORT || 5173);

const app = express();
app.disable("x-powered-by");
app.use(compression());
app.use(express.json({ limit: "32kb" }));
app.use((_req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  next();
});

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, service: "dfwmeteo-weather", now: new Date().toISOString() });
});

app.get("/api/weather", async (req, res, next) => {
  try {
    const latitude = Number(req.query.lat);
    const longitude = Number(req.query.lon);
    if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) {
      res.status(400).json({ error: "invalid_latitude" });
      return;
    }
    if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
      res.status(400).json({ error: "invalid_longitude" });
      return;
    }

    const name = String(req.query.name || "Selected location").slice(0, 120);
    const country = String(req.query.country || "").slice(0, 120);
    const countryCode = String(req.query.countryCode || "").slice(0, 3);
    const admin1 = req.query.admin1 ? String(req.query.admin1).slice(0, 120) : undefined;
    const timezone = req.query.timezone ? String(req.query.timezone) : undefined;
    const force = req.query.force === "1";

    const language = String(req.query.lang || "en");
    const safeLanguage = ["en", "fr", "nl"].includes(language)
      ? (language as "en" | "fr" | "nl")
      : "en";

    const useIrm =
      countryCode.toUpperCase() === "BE" ||
      (countryCode === "" && isBelgiumCoordinate(latitude, longitude));
    const [payload, official] = await Promise.all([
      getWeather(
        {
          latitude,
          longitude,
          name,
          country,
          countryCode,
          admin1,
          timezone,
        },
        { force },
      ),
      useIrm ? getIrmOfficial(latitude, longitude, safeLanguage).catch(() => null) : Promise.resolve(null),
    ]);

    res.setHeader("Cache-Control", "private, max-age=30");
    res.setHeader("X-DFWMeteo-Cache", payload.cacheState);
    res.json({ ...payload, official });
  } catch (error) {
    next(error);
  }
});

app.get("/api/precip-map", async (req, res, next) => {
  try {
    const latitude = Number(req.query.lat);
    const longitude = Number(req.query.lon);
    if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) {
      res.status(400).json({ error: "invalid_latitude" });
      return;
    }
    if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
      res.status(400).json({ error: "invalid_longitude" });
      return;
    }

    const map = await getPrecipMap(latitude, longitude);
    res.setHeader("Cache-Control", "private, max-age=300");
    res.json(map);
  } catch (error) {
    next(error);
  }
});

app.get("/api/geocode", async (req, res, next) => {
  try {
    const query = String(req.query.q || "").slice(0, 100);
    const language = String(req.query.lang || "en");
    const safeLanguage = ["en", "fr", "nl"].includes(language)
      ? (language as "en" | "fr" | "nl")
      : "en";
    const results = await geocode(query, safeLanguage);
    res.setHeader("Cache-Control", "public, max-age=3600");
    res.json(results);
  } catch (error) {
    next(error);
  }
});

app.get("/api/reverse", async (req, res, next) => {
  try {
    const latitude = Number(req.query.lat);
    const longitude = Number(req.query.lon);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      res.status(400).json({ error: "invalid_coordinates" });
      return;
    }
    const language = String(req.query.lang || "en");
    const safeLanguage = ["en", "fr", "nl"].includes(language)
      ? (language as "en" | "fr" | "nl")
      : "en";
    const place = await reverseGeocode(latitude, longitude, safeLanguage);
    res.json(place);
  } catch (error) {
    next(error);
  }
});

app.use("/api", (_req, res) => {
  res.status(404).json({ error: "not_found" });
});

app.use(
  express.static(publicDir, {
    index: false,
    maxAge: isDev ? 0 : "1h",
    setHeaders: (res, filePath) => {
      if (filePath.includes(`${path.sep}fonts${path.sep}`)) {
        res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
      }
    },
  }),
);

app.use((req, res, next) => {
  if (req.method !== "GET") {
    next();
    return;
  }
  res.sendFile(path.join(publicDir, "index.html"));
});

app.use(
  (
    error: unknown,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction,
  ) => {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error(`[dfwmeteo] ${message}`);
    if (res.headersSent) return;
    res.status(502).json({
      error: "weather_unavailable",
      message: "The forecast models could not be reached. Please try again.",
    });
  },
);

app.listen(port, "127.0.0.1", () => {
  console.log(`\n  DFWMeteo weather  ·  http://127.0.0.1:${port}\n`);
});
