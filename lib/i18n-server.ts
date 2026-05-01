import { cookies } from "next/headers";
import { normalizeLocale, t, type TranslationValues } from "@/lib/i18n";

export async function getCurrentLocale() {
  const cookieStore = await cookies();
  return normalizeLocale(cookieStore.get("scadacom_locale")?.value);
}

export async function getTranslator() {
  const locale = await getCurrentLocale();
  return {
    locale,
    dir: locale === "ar" ? "rtl" : "ltr",
    t: (key: string, values?: TranslationValues) => t(locale, key, values)
  };
}
