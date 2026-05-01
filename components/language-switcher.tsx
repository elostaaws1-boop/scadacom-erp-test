"use client";

import { useRouter } from "next/navigation";
import { localeLabels, locales, type Locale } from "@/lib/i18n";
import { useTranslation } from "@/components/translated-text";

export function LanguageSwitcher({ currentLocale }: { currentLocale: Locale }) {
  const router = useRouter();
  const { t } = useTranslation();

  return (
    <select
      className="focus-ring h-10 rounded-md border border-black/10 bg-white px-2 text-sm font-semibold"
      value={currentLocale}
      onChange={(event) => {
        document.cookie = `scadacom_locale=${event.target.value}; path=/; max-age=31536000; SameSite=Lax`;
        router.refresh();
      }}
      aria-label={t("app.language")}
      title={t("app.language")}
    >
      {locales.map((locale) => (
        <option value={locale} key={locale}>
          {localeLabels[locale]}
        </option>
      ))}
    </select>
  );
}
