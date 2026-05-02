import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { pushConfigured } from "@/lib/push";

export async function GET() {
  return Response.json({ publicKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? null, configured: pushConfigured() });
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) return new Response("Unauthorized", { status: 401 });
  const body = (await request.json().catch(() => null)) as {
    endpoint?: string;
    keys?: { p256dh?: string; auth?: string };
    deviceName?: string;
  } | null;
  if (!body?.endpoint || !body.keys?.p256dh || !body.keys?.auth) {
    return Response.json({ error: "Invalid push subscription." }, { status: 400 });
  }
  const subscription = await prisma.pushSubscription.upsert({
    where: { endpoint: body.endpoint },
    update: { userId: session.user.id, keys: body.keys, deviceName: body.deviceName, lastUsedAt: new Date() },
    create: { userId: session.user.id, endpoint: body.endpoint, keys: body.keys, deviceName: body.deviceName, lastUsedAt: new Date() }
  });
  await prisma.notificationPreference.upsert({
    where: { userId: session.user.id },
    update: { pushEnabled: true },
    create: { userId: session.user.id, pushEnabled: true }
  });
  return Response.json({ ok: true, id: subscription.id });
}
