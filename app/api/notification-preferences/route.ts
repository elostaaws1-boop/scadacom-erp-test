import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) return new Response("Unauthorized", { status: 401 });
  const body = (await request.json().catch(() => null)) as {
    pushEnabled?: boolean;
    vibrationEnabled?: boolean;
    criticalOnly?: boolean;
    emailEnabledFuture?: boolean;
  } | null;
  const preference = await prisma.notificationPreference.upsert({
    where: { userId: session.user.id },
    update: {
      pushEnabled: body?.pushEnabled,
      vibrationEnabled: body?.vibrationEnabled,
      criticalOnly: body?.criticalOnly,
      emailEnabledFuture: body?.emailEnabledFuture
    },
    create: {
      userId: session.user.id,
      pushEnabled: Boolean(body?.pushEnabled),
      vibrationEnabled: body?.vibrationEnabled ?? true,
      criticalOnly: Boolean(body?.criticalOnly),
      emailEnabledFuture: Boolean(body?.emailEnabledFuture)
    }
  });
  return Response.json(preference);
}
