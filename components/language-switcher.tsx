"use client";

import { useRouter } from "next/navigation";
import { localeLabels, locales, type Locale } from "@/lib/i18n";

export function LanguageSwitcher({ currentLocale }: { currentLocale: Locale }) {
  const router = useRouter();

  return (
    <label className="sr-only">
      Language
      <select
        className="not-sr-only focus-ring h-10 rounded-md border border-black/10 bg-white px-2 text-sm font-semibold"
        value={currentLocale}
        onChange={(event) => {
          document.cookie = `scadacom_locale=${event.target.value}; path=/; max-age=31536000; SameSite=Lax`;
          router.refresh();
        }}
        aria-label="Language"
      >
        {locales.map((locale) => (
          <option value={locale} key={locale}>
            {localeLabels[locale]}
          </option>
        ))}
      </select>
    </label>
  );
}
