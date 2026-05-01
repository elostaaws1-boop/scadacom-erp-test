import type { Metadata, Viewport } from "next";
import { PwaRegister } from "@/components/pwa-register";
import { getCurrentLocale } from "@/lib/i18n-server";
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
  const locale = await getCurrentLocale();

  return (
    <html lang={locale} dir={locale === "ar" ? "rtl" : "ltr"}>
      <body>
        <PwaRegister />
        {children}
      </body>
    </html>
  );
}
