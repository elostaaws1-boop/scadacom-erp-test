import { redirect } from "next/navigation";
import { LogOut } from "lucide-react";
import { auth, signOut } from "@/auth";
import { LanguageSwitcher } from "@/components/language-switcher";
import { NotificationBell } from "@/components/notification-bell";
import { getTranslator } from "@/lib/i18n-server";
import { getNotificationBadgeCounts } from "@/lib/notifications";
import { roleLabels, visibleNavigationFor } from "@/lib/rbac";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const items = visibleNavigationFor(session.user.role, session.user.email);
  const badgeCounts = await getNotificationBadgeCounts(session.user);
  const { locale, t } = await getTranslator();
  const isRtl = locale === "ar";

  async function logout() {
    "use server";
    await signOut({ redirectTo: "/login" });
  }

  return (
    <div className="min-h-screen bg-field text-ink" data-app-dir={isRtl ? "rtl" : "ltr"}>
      <aside className="app-sidebar fixed top-0 hidden h-screen w-72 flex-col overflow-hidden bg-white px-4 py-5 lg:flex">
        <div className="shrink-0 px-2">
          <img src="/scadacom-logo.png" alt="ScadaCom" className={`h-14 w-auto rounded-md object-contain ${isRtl ? "mr-auto" : ""}`} />
          <p className="mt-4 text-xs font-semibold uppercase tracking-[0.18em] text-mint">ScadaCom</p>
          <h1 className="mt-1 text-xl font-semibold">{t("app.product")}</h1>
          <div className="mt-4">
            <p className={`mb-2 text-xs font-semibold uppercase text-stone-500 ${isRtl ? "" : "tracking-[0.18em]"}`}>{t("app.language")}</p>
            <LanguageSwitcher currentLocale={locale} />
          </div>
        </div>
        <nav className="mt-8 grid min-h-0 flex-1 gap-1 overflow-y-auto overscroll-contain pb-6 pr-1">
          {items.map((item) => (
            <a className={`flex items-center justify-between gap-2 rounded-md px-3 py-2 text-sm font-medium text-stone-700 hover:bg-field hover:text-ink ${isRtl ? "text-right" : ""}`} href={item.href} key={item.href}>
              <span>{t(item.labelKey)}</span>
              <NavBadge badge={badgeCounts[item.href as keyof typeof badgeCounts]} />
            </a>
          ))}
        </nav>
      </aside>
      <div className="app-content">
        <header className="sticky top-0 z-20 border-b border-black/10 bg-white/95 px-4 py-3 backdrop-blur lg:px-8">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <img src="/scadacom-logo.png" alt="ScadaCom" className="h-10 w-10 rounded-md object-cover lg:hidden" />
              <div>
                <p className="text-sm font-semibold">{session.user.name}</p>
                <p className="text-xs text-stone-500">{t(roleLabels[session.user.role])}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <NotificationBell locale={locale} />
              <LanguageSwitcher currentLocale={locale} />
              <form action={logout}>
                <button className="focus-ring inline-flex h-10 w-10 items-center justify-center rounded-md border border-black/10" title={t("app.signOut")}>
                  <LogOut size={18} />
                </button>
              </form>
            </div>
          </div>
          <nav className="mt-3 flex gap-2 overflow-x-auto pb-1 lg:hidden">
            {items.map((item) => (
              <a className="inline-flex items-center gap-2 whitespace-nowrap rounded-md border border-black/10 bg-white px-3 py-2 text-sm" href={item.href} key={item.href}>
                <span>{t(item.labelKey)}</span>
                <NavBadge badge={badgeCounts[item.href as keyof typeof badgeCounts]} />
              </a>
            ))}
          </nav>
        </header>
        <main className="px-4 py-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}

function NavBadge({ badge }: { badge?: { count: number; severity: "warning" | "critical" } }) {
  if (!badge?.count) return null;
  return (
    <span className={`min-w-5 rounded-full px-1.5 py-0.5 text-center text-[11px] font-bold text-white ${badge.severity === "critical" ? "bg-red-600" : "bg-amber-500"}`}>
      {badge.count}
    </span>
  );
}
