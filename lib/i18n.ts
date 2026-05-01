import en from "@/locales/en.json";
import fr from "@/locales/fr.json";
import ar from "@/locales/ar.json";

export const locales = ["en", "fr", "ar"] as const;
export type Locale = (typeof locales)[number];
export type TranslationValues = Record<string, string | number>;

export const localeLabels: Record<Locale, string> = {
  en: "EN",
  fr: "FR",
  ar: "AR"
};

const dictionaries = { en, fr, ar } as const;

export function normalizeLocale(value?: string | null): Locale {
  return locales.includes(value as Locale) ? (value as Locale) : "en";
}

export function t(locale: Locale, key: string, values?: TranslationValues) {
  const value = lookup(dictionaries[locale], key);
  const fallback = lookup(dictionaries.en, key);
  const raw = value ?? fallback ?? (process.env.NODE_ENV === "development" ? `[missing:${key}]` : key);
  return interpolate(String(raw), values);
}

export function translate(locale: Locale, key: string, values?: TranslationValues) {
  return t(locale, key, values);
}

export function hasTranslation(locale: Locale, key: string) {
  return lookup(dictionaries[locale], key) != null;
}

export function allTranslationKeys(locale: Locale = "en") {
  return flattenKeys(dictionaries[locale]);
}

function lookup(source: unknown, key: string) {
  return key.split(".").reduce<unknown>((current, part) => {
    if (!current || typeof current !== "object") return undefined;
    return (current as Record<string, unknown>)[part];
  }, source);
}

function interpolate(value: string, values?: TranslationValues) {
  if (!values) return value;
  return value.replace(/\{\{(\w+)\}\}/g, (_, name: string) => String(values[name] ?? ""));
}

function flattenKeys(source: unknown, prefix = ""): string[] {
  if (!source || typeof source !== "object") return [];
  return Object.entries(source as Record<string, unknown>).flatMap(([key, value]) => {
    const nextKey = prefix ? `${prefix}.${key}` : key;
    return value && typeof value === "object" ? flattenKeys(value, nextKey) : [nextKey];
  });
}
