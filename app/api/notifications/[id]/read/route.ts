import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return new Response("Unauthorized", { status: 401 });
  const { id } = await params;
  await prisma.notification.updateMany({
    where: { id, recipientUserId: session.user.id },
    data: { isRead: true, readAt: new Date() }
  });
  return Response.json({ ok: true });
}
