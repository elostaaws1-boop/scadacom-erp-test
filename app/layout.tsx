import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import { PwaRegister } from "@/components/pwa-register";
import { normalizeLocale } from "@/lib/i18n";
import "./globals.css";

export const metadata: Metadata = {
  title: "ScadaCom ERP",
  description: "Internal ERP-lite platform for ScadaCom telecom field operations.",
  manifest: "/manifest.webmanifest",
  applicationName: "ScadaCom Technician",
  appleWebApp: {
    capable: true,
    title: "ScadaCom",
    statusBarStyle: "black-translucent"
  },
  icons: {
    icon: [
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" }
    ],
    apple: [{ url: "/icon-192.png", sizes: "192x192", type: "image/png" }]
  }
};

export const viewport: Viewport = {
  themeColor: "#17201b"
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const cookieStore = await cookies();
  const locale = normalizeLocale(cookieStore.get("scadacom_locale")?.value);

  return (
    <html lang={locale} dir={locale === "ar" ? "rtl" : "ltr"}>
      <body>
        <PwaRegister />
        {children}
      </body>
    </html>
  );
}
