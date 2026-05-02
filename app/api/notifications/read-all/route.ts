import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function POST() {
  const session = await auth();
  if (!session?.user) return new Response("Unauthorized", { status: 401 });
  await prisma.notification.updateMany({
    where: { recipientUserId: session.user.id, isRead: false },
    data: { isRead: true, readAt: new Date() }
  });
  return Response.json({ ok: true });
}
