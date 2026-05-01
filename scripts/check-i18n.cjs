const fs = require("fs");
const path = require("path");

const root = process.cwd();
const localeDir = path.join(root, "locales");
const sourceDirs = ["app", "components", "lib"].map((dir) => path.join(root, dir));
const localeNames = ["en", "fr", "ar"];

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function flatten(source, prefix = "", output = new Set()) {
  for (const [key, value] of Object.entries(source)) {
    const next = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === "object" && !Array.isArray(value)) flatten(value, next, output);
    else output.add(next);
  }
  return output;
}

function walk(dir, files = []) {
  if (!fs.existsSync(dir)) return files;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, files);
    else if (/\.(tsx|ts)$/.test(entry.name)) files.push(full);
  }
  return files;
}

const dictionaries = Object.fromEntries(localeNames.map((locale) => [locale, readJson(path.join(localeDir, `${locale}.json`))]));
const keys = Object.fromEntries(localeNames.map((locale) => [locale, flatten(dictionaries[locale])]));
const baseKeys = keys.en;
const used = new Set();
const hardcodedCandidates = [];

const keyPatterns = [
  /\bt\(\s*["'`]([^"'`]+)["'`]/g,
  /\btranslate\(\s*[^,]+,\s*["'`]([^"'`]+)["'`]/g,
  /\bk=["'`]([^"'`]+)["'`]/g,
  /\b(?:titleKey|descriptionKey|labelKey|detailKey)=["'`]([^"'`]+)["'`]/g
];

for (const file of sourceDirs.flatMap((dir) => walk(dir))) {
  const content = fs.readFileSync(file, "utf8");
  for (const pattern of keyPatterns) {
    for (const match of content.matchAll(pattern)) used.add(match[1]);
  }
  for (const match of content.matchAll(/>\s*([A-Za-z][^<>{}\n]{2,})\s*</g)) {
    const text = match[1].trim();
    if (!/^(ScadaCom|MAD|PDF|Excel|GPS|CASH|BANK|CARD|ADVANCE|INCOMING|OUTGOING)$/.test(text)) {
      hardcodedCandidates.push(`${path.relative(root, file)}: ${text}`);
    }
  }
}

const missing = {};
for (const locale of localeNames.filter((locale) => locale !== "en")) {
  missing[locale] = [...baseKeys].filter((key) => !keys[locale].has(key));
}

const missingUsed = {};
for (const locale of localeNames) {
  missingUsed[locale] = [...used].filter((key) => !keys[locale].has(key));
}

const unused = [...baseKeys].filter((key) => !used.has(key));

console.log("i18n key check");
console.log(`Used keys: ${used.size}`);
console.log(`Unused keys: ${unused.length}`);
for (const locale of localeNames.filter((locale) => locale !== "en")) {
  console.log(`Missing ${locale} keys: ${missing[locale].length}`);
}
for (const locale of localeNames) {
  console.log(`Missing used ${locale} keys: ${missingUsed[locale].length}`);
}
console.log(`Hardcoded text candidates: ${hardcodedCandidates.length}`);

if (unused.length) {
  console.log("\nUnused keys:");
  unused.slice(0, 200).forEach((key) => console.log(`  - ${key}`));
}

for (const locale of localeNames.filter((locale) => locale !== "en")) {
  if (missing[locale].length) {
    console.log(`\nMissing ${locale} keys:`);
    missing[locale].forEach((key) => console.log(`  - ${key}`));
  }
}

for (const locale of localeNames) {
  if (missingUsed[locale].length) {
    console.log(`\nMissing used ${locale} keys:`);
    missingUsed[locale].forEach((key) => console.log(`  - ${key}`));
  }
}

if (hardcodedCandidates.length) {
  console.log("\nHardcoded visible text candidates:");
  hardcodedCandidates.slice(0, 200).forEach((item) => console.log(`  - ${item}`));
}

if (Object.values(missing).some((items) => items.length) || Object.values(missingUsed).some((items) => items.length)) {
  process.exitCode = 1;
}
