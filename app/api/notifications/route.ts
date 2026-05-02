import { auth } from "@/auth";
import { ensureSystemNotificationsForUser } from "@/lib/notifications";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session?.user) return new Response("Unauthorized", { status: 401 });
  await ensureSystemNotificationsForUser(session.user);
  const [notifications, unreadCount, preference] = await Promise.all([
    prisma.notification.findMany({
      where: { recipientUserId: session.user.id },
      orderBy: { createdAt: "desc" },
      take: 20
    }),
    prisma.notification.count({ where: { recipientUserId: session.user.id, isRead: false } }),
    prisma.notificationPreference.upsert({
      where: { userId: session.user.id },
      update: {},
      create: { userId: session.user.id }
    })
  ]);

  return Response.json({
    unreadCount,
    preference,
    notifications: notifications.map((notification) => ({
      id: notification.id,
      title: notification.title,
      message: notification.message,
      type: notification.type,
      severity: notification.severity,
      relatedModule: notification.relatedModule,
      relatedRecordId: notification.relatedRecordId,
      isRead: notification.isRead,
      createdAt: notification.createdAt.toISOString(),
      url: notification.metadata && typeof notification.metadata === "object" && "url" in notification.metadata ? String(notification.metadata.url) : `/${notification.relatedModule}`
    }))
  });
}
