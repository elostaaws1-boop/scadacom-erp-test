"use client";

import { useEffect, useState } from "react";
import { normalizeLocale, translate } from "@/lib/i18n";

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

export function TranslatedText({ text }: { text: string }) {
  const locale = useClientLocale();
  return <>{translate(locale, text)}</>;
}

export function T({ text }: { text: string }) {
  return <TranslatedText text={text} />;
}
