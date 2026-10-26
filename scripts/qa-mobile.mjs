import fs from "node:fs";

const CDP_HOST = "http://127.0.0.1:9223";
const URL =
  "http://127.0.0.1:4173/?lat=50.8503&lon=4.3517&name=Brussels&country=Belgium&countryCode=BE&lang=en";
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

class CDP {
  constructor(url) {
    this.id = 0;
    this.pending = new Map();
    this.exceptions = [];
    this.console = [];
    this.ws = new WebSocket(url);
    this.ready = new Promise((resolve, reject) => {
      this.ws.addEventListener("open", resolve);
      this.ws.addEventListener("error", reject);
    });
    this.ws.addEventListener("message", (event) => {
      const message = JSON.parse(String(event.data));
      if (message.id) {
        const pending = this.pending.get(message.id);
        if (!pending) return;
        this.pending.delete(message.id);
        if (message.error) pending.reject(new Error(message.error.message));
        else pending.resolve(message.result);
        return;
      }
      if (message.method === "Runtime.exceptionThrown") {
        this.exceptions.push(
          message.params.exceptionDetails?.exception?.description ||
            message.params.exceptionDetails?.text,
        );
      }
      if (message.method === "Runtime.consoleAPICalled") {
        this.console.push(message.params.args.map((arg) => arg.value ?? arg.description).join(" "));
      }
    });
  }
  send(method, params = {}) {
    const id = ++this.id;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }
  async eval(expression) {
    const result = await this.send("Runtime.evaluate", {
      expression,
      awaitPromise: true,
      returnByValue: true,
    });
    if (result.exceptionDetails) {
      throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
    }
    return result.result.value;
  }
}

async function waitFor(cdp, expression, timeout = 15000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    if (await cdp.eval(expression)) return true;
    await delay(250);
  }
  return false;
}

async function screenshot(cdp, file) {
  const shot = await cdp.send("Page.captureScreenshot", {
    format: "png",
    captureBeyondViewport: false,
  });
  fs.writeFileSync(file, Buffer.from(shot.data, "base64"));
}

const target = await (
  await fetch(`${CDP_HOST}/json/new?${encodeURIComponent(URL)}`, { method: "PUT" })
).json();
const cdp = new CDP(target.webSocketDebuggerUrl);
await cdp.ready;
await cdp.send("Page.enable");
await cdp.send("Runtime.enable");
await cdp.send("Emulation.setDeviceMetricsOverride", {
  width: 390,
  height: 844,
  deviceScaleFactor: 1,
  mobile: false,
});
await cdp.send("Page.reload");
await waitFor(cdp, "!!document.querySelector('.hero') || !!document.querySelector('.error-card')");
await delay(2500);

const overview = await cdp.eval(`({
  viewport: window.innerWidth,
  scrollWidth: document.documentElement.scrollWidth,
  city: document.querySelector('.hero h1')?.textContent,
  official: document.querySelector('.official-source')?.innerText,
  officialTemp: document.querySelector('.official-temp')?.textContent,
  errors: window.__errors || []
})`);
console.log("overview", JSON.stringify(overview, null, 2));
await screenshot(cdp, "C:\\Users\\noah\\AppData\\Local\\Temp\\dfwmeteo-mobile.png");

await cdp.eval(`document.querySelector('.details-card').scrollIntoView({block:'start'})`);
await delay(700);
const tiles = await cdp.eval(`[...document.querySelectorAll('.detail-tile')].map((tile) => {
  const t = tile.getBoundingClientRect();
  const h = tile.querySelector('.detail-head').getBoundingClientRect();
  const v = tile.querySelector('.detail-value')?.getBoundingClientRect();
  return {
    cls: tile.className,
    tile: Math.round(t.left) + '-' + Math.round(t.right),
    head: Math.round(h.left) + '-' + Math.round(h.right),
    headCenterOffset: Math.round((h.left + h.right) / 2 - (t.left + t.right) / 2),
    valueCenterOffset: v ? Math.round((v.left + v.right) / 2 - (t.left + t.right) / 2) : null
  };
})`);
console.log("tiles", JSON.stringify(tiles, null, 2));
await screenshot(cdp, "C:\\Users\\noah\\AppData\\Local\\Temp\\dfwmeteo-details-mobile.png");

await cdp.eval(`document.querySelector('#models').scrollIntoView({block:'start'})`);
await delay(500);
await screenshot(cdp, "C:\\Users\\noah\\AppData\\Local\\Temp\\dfwmeteo-model-mobile.png");

console.log(
  "diagnostics",
  JSON.stringify({ exceptions: cdp.exceptions, console: cdp.console }, null, 2),
);
await cdp.send("Page.close");
cdp.ws.close();
