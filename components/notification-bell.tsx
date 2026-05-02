"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Bell, CheckCheck } from "lucide-react";
import { translate, type Locale } from "@/lib/i18n";

type NotificationItem = {
  id: string;
  title: string;
  message: string;
  type: string;
  severity: "INFO" | "WARNING" | "CRITICAL";
  isRead: boolean;
  createdAt: string;
  url: string;
};

type Preference = {
  pushEnabled: boolean;
  vibrationEnabled: boolean;
  criticalOnly: boolean;
  emailEnabledFuture: boolean;
};

export function NotificationBell({ locale }: { locale: Locale }) {
  const [open, setOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [preference, setPreference] = useState<Preference | null>(null);
  const [pushStatus, setPushStatus] = useState("");
  const seenCritical = useRef(new Set<string>());

  async function loadNotifications() {
    const response = await fetch("/api/notifications", { cache: "no-store" });
    if (!response.ok) return;
    const data = (await response.json()) as { unreadCount: number; notifications: NotificationItem[]; preference: Preference };
    setUnreadCount(data.unreadCount);
    setItems(data.notifications);
    setPreference(data.preference);
    const newCritical = data.notifications.find((item) => !item.isRead && item.severity === "CRITICAL" && !seenCritical.current.has(item.id));
    if (newCritical && data.preference.vibrationEnabled && "vibrate" in navigator) {
      navigator.vibrate([200, 100, 200]);
      seenCritical.current.add(newCritical.id);
    }
  }

  useEffect(() => {
    loadNotifications();
    const timer = window.setInterval(loadNotifications, 30000);
    return () => window.clearInterval(timer);
  }, []);

  async function markAllRead() {
    await fetch("/api/notifications/read-all", { method: "POST" });
    await loadNotifications();
  }

  async function openNotification(item: NotificationItem) {
    await fetch(`/api/notifications/${item.id}/read`, { method: "POST" });
    window.location.href = item.url;
  }

  async function updatePreference(next: Partial<Preference>) {
    const updated = { ...(preference ?? defaultPreference), ...next };
    setPreference(updated);
    await fetch("/api/notification-preferences", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updated)
    });
    await loadNotifications();
  }

  async function enablePush() {
    setPushStatus("");
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      setPushStatus(translate(locale, "notifications.pushUnsupported"));
      return;
    }
    const configResponse = await fetch("/api/push-subscriptions");
    const config = (await configResponse.json()) as { publicKey?: string | null; configured: boolean };
    if (!config.configured || !config.publicKey) {
      setPushStatus(translate(locale, "notifications.pushNotConfigured"));
      return;
    }
    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      setPushStatus(translate(locale, "notifications.pushDenied"));
      return;
    }
    const registration = await navigator.serviceWorker.ready;
    const subscription =
      (await registration.pushManager.getSubscription()) ??
      (await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(config.publicKey)
      }));
    await fetch("/api/push-subscriptions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...subscription.toJSON(), deviceName: navigator.userAgent.slice(0, 120) })
    });
    await updatePreference({ pushEnabled: true });
    setPushStatus(translate(locale, "notifications.pushEnabled"));
  }

  const latest = useMemo(() => items.slice(0, 8), [items]);

  return (
    <div className="relative">
      <button
        className="focus-ring relative inline-flex h-10 w-10 items-center justify-center rounded-md border border-black/10 bg-white"
        onClick={() => setOpen((value) => !value)}
        title={translate(locale, "notifications.center")}
        type="button"
      >
        <Bell size={18} />
        {unreadCount > 0 ? <span className="absolute -right-1 -top-1 min-w-5 rounded-full bg-red-600 px-1 text-center text-xs font-bold text-white">{unreadCount}</span> : null}
      </button>
      {open ? (
        <div className="absolute end-0 top-12 z-50 w-[min(92vw,420px)] rounded-lg border border-black/10 bg-white p-3 shadow-xl">
          <div className="flex items-center justify-between gap-3 border-b border-black/10 pb-3">
            <div>
              <p className="font-semibold text-ink">{translate(locale, "notifications.center")}</p>
              <p className="text-xs text-stone-500">{translate(locale, "notifications.polling")}</p>
            </div>
            <button className="inline-flex items-center gap-1 rounded-md border border-black/10 px-2 py-1 text-xs font-semibold" onClick={markAllRead} type="button">
              <CheckCheck size={14} />
              {translate(locale, "notifications.markAllRead")}
            </button>
          </div>

          <div className="max-h-80 overflow-y-auto py-2">
            {latest.length > 0 ? latest.map((item) => (
              <button
                className={`mb-2 w-full rounded-md border p-3 text-start ${item.isRead ? "border-black/10 bg-white" : "border-mint/30 bg-mint/5"}`}
                key={item.id}
                onClick={() => openNotification(item)}
                type="button"
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-semibold text-ink">{translate(locale, item.title)}</p>
                  <span className={`rounded-full px-2 py-1 text-[10px] font-bold ${severityClass(item.severity)}`}>{severityLabel(locale, item.severity)}</span>
                </div>
                <p className="mt-1 text-xs text-stone-600">{translate(locale, item.message)}</p>
                <p className="mt-2 text-[11px] text-stone-400">{new Date(item.createdAt).toLocaleString(locale === "ar" ? "ar" : locale === "fr" ? "fr" : "en")}</p>
              </button>
            )) : <p className="rounded-md border border-dashed border-stone-300 p-4 text-sm text-stone-500">{translate(locale, "notifications.empty")}</p>}
          </div>

          <div className="space-y-2 border-t border-black/10 pt-3 text-xs">
            <button className="rounded-md border border-black/10 px-3 py-2 font-semibold" onClick={enablePush} type="button">{translate(locale, "notifications.enablePush")}</button>
            {pushStatus ? <p className="text-stone-500">{pushStatus}</p> : null}
            <label className="flex items-center justify-between gap-3">
              <span>{translate(locale, "notifications.vibration")}</span>
              <input checked={preference?.vibrationEnabled ?? true} onChange={(event) => updatePreference({ vibrationEnabled: event.target.checked })} type="checkbox" />
            </label>
            <label className="flex items-center justify-between gap-3">
              <span>{translate(locale, "notifications.criticalOnly")}</span>
              <input checked={preference?.criticalOnly ?? false} onChange={(event) => updatePreference({ criticalOnly: event.target.checked })} type="checkbox" />
            </label>
          </div>
        </div>
      ) : null}
    </div>
  );
}

const defaultPreference: Preference = {
  pushEnabled: false,
  vibrationEnabled: true,
  criticalOnly: false,
  emailEnabledFuture: false
};

function severityClass(severity: NotificationItem["severity"]) {
  if (severity === "CRITICAL") return "bg-red-100 text-red-700";
  if (severity === "WARNING") return "bg-amber-100 text-amber-800";
  return "bg-sky-100 text-sky-700";
}

function severityLabel(locale: Locale, severity: NotificationItem["severity"]) {
  if (severity === "CRITICAL") return translate(locale, "notifications.severity.CRITICAL");
  if (severity === "WARNING") return translate(locale, "notifications.severity.WARNING");
  return translate(locale, "notifications.severity.INFO");
}

function urlBase64ToUint8Array(value: string) {
  const padding = "=".repeat((4 - (value.length % 4)) % 4);
  const base64 = (value + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(base64);
  return Uint8Array.from([...raw].map((char) => char.charCodeAt(0)));
}
