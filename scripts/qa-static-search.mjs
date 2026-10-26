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

const target = await (
  await fetch(`${CDP_HOST}/json/new?${encodeURIComponent(URL)}`, { method: "PUT" })
).json();
const cdp = new CDP(target.webSocketDebuggerUrl);
await cdp.ready;
await cdp.send("Page.enable");
await cdp.send("Runtime.enable");
await cdp.send("Emulation.setDeviceMetricsOverride", {
  width: 1440,
  height: 1000,
  deviceScaleFactor: 1,
  mobile: false,
});
await cdp.send("Page.reload");
await waitFor(cdp, "!!document.querySelector('.hero')");
await delay(2000);

await cdp.eval(`document.querySelector('[data-action="search"]').click()`);
await delay(300);
await cdp.eval(`
  const input = document.querySelector('#search-input');
  input.value = 'Ghent';
  input.dispatchEvent(new Event('input', {bubbles:true}));
`);
await waitFor(cdp, "document.querySelectorAll('#search-body .place-main').length > 0");
await delay(300);
const results = await cdp.eval(`({
  focus: document.activeElement?.id,
  items: [...document.querySelectorAll('#search-body .place-main .place-copy b')].map(el=>el.textContent).slice(0,4),
  modal: !!document.querySelector('.modal')
})`);
console.log("search", JSON.stringify(results, null, 2));
await cdp.eval(`document.querySelector('#search-body .place-main').click()`);
await waitFor(cdp, "document.querySelector('.hero h1')?.textContent === 'Ghent'");
await delay(1800);
const selected = await cdp.eval(`({
  city: document.querySelector('.hero h1')?.textContent,
  official: document.querySelector('.official-source')?.innerText.replace(/\\s+/g,' ').trim(),
  officialTemp: document.querySelector('.official-temp')?.textContent,
  errors: window.__errors || []
})`);
console.log("selected", JSON.stringify(selected, null, 2));

// Simulate a successful browser geolocation call and click the locate action.
await cdp.eval(`
  navigator.geolocation.getCurrentPosition = (success) => success({
    coords: {latitude: 51.0543, longitude: 3.7174, accuracy: 20}
  });
  document.querySelector('[data-action="search"]').click();
`);
await delay(300);
await cdp.eval(`document.querySelector('[data-action="locate"]').click()`);
await waitFor(cdp, `!document.querySelector('.modal')`);
await delay(1200);
const located = await cdp.eval(`({
  city: document.querySelector('.hero h1')?.textContent,
  subtitle: document.querySelector('.hero-sub')?.textContent.replace(/\\s+/g,' ').trim(),
  official: !!document.querySelector('.official-source'),
  errors: window.__errors || []
})`);
console.log("located", JSON.stringify(located, null, 2));
console.log("exceptions", JSON.stringify(cdp.exceptions));
await cdp.send("Page.close");
cdp.ws.close();
