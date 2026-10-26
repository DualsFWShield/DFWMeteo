import fs from "node:fs";
import { DICTS, missingKeys, hasKey } from "../public/js/i18n.js";

const files = ["public/js/app.js", "public/js/charts.js"];
const keys = new Set();
for (const file of files) {
  const text = fs.readFileSync(file, "utf8");
  for (const regex of [/\btr\("([^"]+)"/g, /\btranslate\("([^"]+)"/g]) {
    let match;
    while ((match = regex.exec(text))) keys.add(match[1]);
  }
}

const missing = [...keys].filter((key) => !hasKey("en", key)).sort();
console.log(`literal keys: ${keys.size}`);
console.log(`missing in English: ${missing.length}`);
if (missing.length) console.log(missing.join("\n"));

for (const locale of Object.keys(DICTS)) {
  const missingLocale = missingKeys(locale).filter((key) => keys.has(key));
  console.log(`${locale}: ${missingKeys(locale).length} missing overall; ${missingLocale.length} used keys missing`);
}
