import webpush from "web-push";
import type { NotificationSeverity } from "@prisma/client";
import { prisma } from "@/lib/prisma";

const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const privateKey = process.env.VAPID_PRIVATE_KEY;
const subject = process.env.VAPID_SUBJECT ?? "mailto:admin@scadacom.local";

if (publicKey && privateKey) {
  webpush.setVapidDetails(subject, publicKey, privateKey);
}

export function pushConfigured() {
  return Boolean(publicKey && privateKey);
}

export async function sendPushToUser(input: {
  userId: string;
  title: string;
  body: string;
  url: string;
  severity: NotificationSeverity;
}) {
  if (!pushConfigured()) return;
  const preference = await prisma.notificationPreference.findUnique({ where: { userId: input.userId } });
  if (!preference?.pushEnabled) return;
  if (preference.criticalOnly && input.severity !== "CRITICAL") return;

  const subscriptions = await prisma.pushSubscription.findMany({ where: { userId: input.userId } });
  await Promise.all(
    subscriptions.map(async (subscription) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: subscription.endpoint,
            keys: subscription.keys as { p256dh: string; auth: string }
          },
          JSON.stringify({
            title: input.title,
            body: input.body,
            url: input.url,
            severity: input.severity,
            vibrate: preference.vibrationEnabled && input.severity === "CRITICAL" ? [200, 100, 200] : undefined
          })
        );
        await prisma.pushSubscription.update({ where: { id: subscription.id }, data: { lastUsedAt: new Date() } });
      } catch {
        await prisma.pushSubscription.delete({ where: { id: subscription.id } }).catch(() => undefined);
      }
    })
  );
}
