import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";
import { fetchIrmSnapshot } from "./fetch-irm.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const publicDir = path.join(root, "public");
const distDir = path.join(root, "dist");

await fs.rm(distDir, { recursive: true, force: true });
await fs.cp(publicDir, distDir, { recursive: true });

// GitHub Pages is static, so the official Belgian layer is refreshed as a
// build-time snapshot. The scheduled Pages workflow keeps it current.
let irm;
try {
  irm = await fetchIrmSnapshot();
} catch {
  irm = { generatedAt: new Date().toISOString(), provider: "IRM / KMI", cities: [] };
}
await fs.mkdir(path.join(distDir, "data"), { recursive: true });
await fs.mkdir(path.join(publicDir, "data"), { recursive: true });
const irmJson = JSON.stringify(irm);
await fs.writeFile(path.join(distDir, "data/irm.json"), irmJson, "utf8");
await fs.writeFile(path.join(publicDir, "data/irm.json"), irmJson, "utf8");

await build({
  entryPoints: [path.join(root, "src-static/static-api.ts")],
  outfile: path.join(distDir, "js/dfwmeteo-api.js"),
  bundle: true,
  format: "iife",
  platform: "browser",
  target: ["chrome100", "safari15", "firefox100"],
  minify: true,
  sourcemap: false,
  legalComments: "none",
  banner: {
    js: "/*! DFWMeteo static engine — generated from the multi-source consensus modules. */",
  },
});

const indexPath = path.join(distDir, "index.html");
let index = await fs.readFile(indexPath, "utf8");
const appScript = '<script type="module" src="./js/app.js"></script>';
if (!index.includes(appScript)) {
  throw new Error("Could not find the app module script in public/index.html");
}
index = index.replace(
  appScript,
  `    <script>window.DFWMETEO_STATIC = true;</script>
    <script src="./js/dfwmeteo-api.js"></script>
    ${appScript}`,
);
index = index.replace(
  '<meta name="theme-color" content="#070b14" />',
  '<meta name="theme-color" content="#070b14" />\n    <meta name="dfwmeteo-build" content="static" />',
);
await fs.writeFile(indexPath, index, "utf8");

// GitHub Pages serves the folder as-is; .nojekyll keeps compatibility with
// underscores and avoids Jekyll processing.
await fs.writeFile(path.join(distDir, ".nojekyll"), "", "utf8");

// A client-side 404 makes direct links resilient without server rewrites.
await fs.copyFile(indexPath, path.join(distDir, "404.html"));

const stats = await fs.stat(path.join(distDir, "js/dfwmeteo-api.js"));
console.log(
  `Static build ready: dist/ (engine ${Math.round(stats.size / 1024)} kB · IRM ${irm.cities.length}/12 centres)`,
);
