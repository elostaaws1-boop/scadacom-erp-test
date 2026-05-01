"use client";

import { useEffect, useState } from "react";
import { normalizeLocale, t, type TranslationValues } from "@/lib/i18n";

function currentLocale() {
  const match = document.cookie.match(/(?:^|; )scadacom_locale=([^;]+)/);
  return normalizeLocale(match ? decodeURIComponent(match[1]) : undefined);
}

export function useClientLocale() {
  const [locale, setLocale] = useState<ReturnType<typeof normalizeLocale>>(() =>
    typeof document === "undefined" ? "en" : currentLocale(),
  );

  useEffect(() => {
    setLocale(currentLocale());
  }, []);

  return locale;
}

export function useTranslation() {
  const locale = useClientLocale();
  return {
    locale,
    dir: locale === "ar" ? "rtl" : "ltr",
    t: (key: string, values?: TranslationValues) => t(locale, key, values)
  };
}

export function TranslatedText({ k, values }: { k: string; values?: TranslationValues }) {
  const { t: translateKey } = useTranslation();
  return <>{translateKey(k, values)}</>;
}

export function T({ k, values }: { k: string; values?: TranslationValues }) {
  return <TranslatedText k={k} values={values} />;
}
