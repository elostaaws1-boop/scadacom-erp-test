import bcrypt from "bcryptjs";
import { headers } from "next/headers";
import { auth } from "@/auth";
import { audit } from "@/lib/audit";
import { answerBossQuestion, buildBossAiContext } from "@/lib/boss-ai";
import { normalizeLocale } from "@/lib/i18n";
import { prisma } from "@/lib/prisma";
import { isBossIdentity } from "@/lib/rbac";

export const runtime = "nodejs";

const WINDOW_MS = 10 * 60 * 1000;
const MAX_REQUESTS = 20;
const rateLimits = new Map<string, { count: number; resetAt: number }>();

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user || !isBossIdentity(session.user.role, session.user.email)) {
    return new Response("Not found", { status: 404 });
  }

  const body = (await request.json().catch(() => null)) as { question?: unknown; passcode?: unknown; locale?: unknown } | null;
  const question = String(body?.question ?? "").trim();
  const passcode = String(body?.passcode ?? "");
  const locale = normalizeLocale(typeof body?.locale === "string" ? body.locale : "en");
  if (!question) return Response.json({ error: "Question is required." }, { status: 400 });
  if (question.length > 1200) return Response.json({ error: "Question is too long." }, { status: 400 });

  const rateLimit = checkRateLimit(session.user.id);
  if (!rateLimit.ok) {
    return Response.json({ error: "Too many assistant questions. Please wait a few minutes." }, { status: 429 });
  }

  const headerList = await headers();
  const ip = headerList.get("x-forwarded-for")?.split(",")[0]?.trim() ?? headerList.get("x-real-ip") ?? undefined;
  const credential = await prisma.bossRoomCredential.findUnique({ where: { id: "boss-room" } });
  const allowed = credential ? await bcrypt.compare(passcode, credential.passcodeHash) : false;
  await prisma.bossRoomAccessLog.create({
    data: { userId: session.user.id, email: session.user.email ?? "unknown", success: allowed, ip }
  });
  if (!allowed) return Response.json({ error: "Invalid boss passcode." }, { status: 403 });

  const context = await buildBossAiContext();
  const result = await answerBossQuestion(question, context, locale);
  await audit({
    actorId: session.user.id,
    action: "BOSS_AI_ASSISTANT_QUERY",
    entity: "BossAiAssistant",
    after: {
      question,
      model: result.model,
      usedFallback: result.usedFallback,
      responseChars: result.answer.length,
      sourceCounts: result.sourceCounts,
      period: context.period
    },
    ip
  });

  return Response.json(result);
}

function checkRateLimit(key: string) {
  const now = Date.now();
  const current = rateLimits.get(key);
  if (!current || current.resetAt <= now) {
    rateLimits.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return { ok: true };
  }
  if (current.count >= MAX_REQUESTS) return { ok: false };
  current.count += 1;
  return { ok: true };
}
