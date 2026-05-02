import bcrypt from "bcryptjs";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { BossRoomConsole, type UnlockState } from "@/components/boss-room-console";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { T } from "@/components/translated-text";
import { audit } from "@/lib/audit";
import { buildBossIntelligenceLayer } from "@/lib/boss-ai";
import { generateMonthlyPerformanceReport } from "@/lib/monthly-report";
import { mad } from "@/lib/money";
import { prisma } from "@/lib/prisma";
import { isBossIdentity } from "@/lib/rbac";

async function unlockBossRoom(_state: UnlockState, formData: FormData): Promise<UnlockState> {
  "use server";
  const session = await auth();
  const headerList = await headers();
  const ip = headerList.get("x-forwarded-for")?.split(",")[0]?.trim() ?? headerList.get("x-real-ip") ?? undefined;
  if (!session?.user || !isBossIdentity(session.user.role, session.user.email)) notFound();

  const passcode = String(formData.get("passcode") ?? "");
  const credential = await prisma.bossRoomCredential.findUnique({ where: { id: "boss-room" } });
  const allowed = credential ? await bcrypt.compare(passcode, credential.passcodeHash) : false;
  await prisma.bossRoomAccessLog.create({
    data: { userId: session.user.id, email: session.user.email ?? "unknown", success: allowed, ip }
  });

  return allowed ? { ok: true } : { ok: false, error: "pages.bossRoom.incorrect" };
}

async function simulate(formData: FormData) {
  "use server";
  const session = await auth();
  const headerList = await headers();
  const ip = headerList.get("x-forwarded-for")?.split(",")[0]?.trim() ?? headerList.get("x-real-ip") ?? undefined;
  if (!session?.user || !isBossIdentity(session.user.role, session.user.email)) notFound();

  const passcode = String(formData.get("passcode") ?? "");
  const credential = await prisma.bossRoomCredential.findUnique({ where: { id: "boss-room" } });
  const allowed = credential ? await bcrypt.compare(passcode, credential.passcodeHash) : false;
  await prisma.bossRoomAccessLog.create({
    data: { userId: session.user.id, email: session.user.email ?? "unknown", success: allowed, ip }
  });
  if (!allowed) throw new Error("Invalid passcode");

  const revenue = Number(formData.get("revenue") ?? 0);
  const manualCost = Number(formData.get("manualCost") ?? 0);
  const totalCost = manualCost;
  const profit = revenue - totalCost;
  const marginPercent = revenue ? (profit / revenue) * 100 : 0;
  const recommendedPricing = totalCost * 1.25;
  const status = profit < 0 ? "LOSS" : marginPercent < 12 ? "RISKY" : "PROFITABLE";
  const projectId = String(formData.get("projectId") ?? "");
  if (projectId) {
    await prisma.profitScenario.create({ data: { projectId, name: String(formData.get("name") || "Scenario"), revenue, manualCost, totalCost, profit, marginPercent, breakEven: totalCost, recommendedPricing, status: status as never, createdById: session.user.id } });
  }
}

async function generateReport(formData: FormData) {
  "use server";
  const session = await auth();
  if (!session?.user || !isBossIdentity(session.user.role, session.user.email)) notFound();
  const month = Number(formData.get("month") ?? new Date().getMonth() + 1);
  const year = Number(formData.get("year") ?? new Date().getFullYear());
  const report = await generateMonthlyPerformanceReport(month, year, session.user.id);
  await audit({ actorId: session.user.id, action: "GENERATE_MONTHLY_REPORT", entity: "MonthlyPerformanceReport", entityId: report.id, after: { month, year, status: report.status } });
  revalidatePath("/boss-room");
}

async function lockReport(formData: FormData) {
  "use server";
  const session = await auth();
  if (!session?.user || !isBossIdentity(session.user.role, session.user.email)) notFound();
  const id = String(formData.get("id") ?? "");
  const before = await prisma.monthlyPerformanceReport.findUniqueOrThrow({ where: { id } });
  const report = await prisma.monthlyPerformanceReport.update({
    where: { id },
    data: { status: "LOCKED", lockedById: session.user.id, lockedAt: new Date() }
  });
  await audit({ actorId: session.user.id, action: "LOCK_MONTHLY_REPORT", entity: "MonthlyPerformanceReport", entityId: report.id, before, after: report });
  revalidatePath("/boss-room");
}

export default async function BossRoomPage() {
  const session = await auth();
  if (!session?.user || !isBossIdentity(session.user.role, session.user.email)) notFound();
  const [projects, reports, intelligence] = await Promise.all([
    prisma.project.findMany({ orderBy: { name: "asc" } }),
    prisma.monthlyPerformanceReport.findMany({ orderBy: [{ year: "desc" }, { month: "desc" }], take: 12 }),
    buildBossIntelligenceLayer()
  ]);
  const auditLogs = await prisma.auditLog.findMany({ orderBy: { createdAt: "desc" }, take: 12, include: { actor: true } });
  return (
    <>
      <PageHeader titleKey="pages.bossRoom.title" descriptionKey="pages.bossRoom.description" />
      <BossRoomConsole
        projects={projects}
        intelligence={intelligence}
        reports={reports.map((report) => ({
          id: report.id,
          month: report.month,
          year: report.year,
          status: report.status,
          generatedAt: report.generatedAt?.toISOString() ?? null,
          lockedAt: report.lockedAt?.toISOString() ?? null,
          snapshot: report.snapshot
        }))}
        unlock={unlockBossRoom}
        simulate={simulate}
        generateReport={generateReport}
        lockReport={lockReport}
      />
      <div className="mt-6 grid gap-4 md:grid-cols-4"><StatCard labelKey="pages.bossRoom.targetMargin" value="25%" /><StatCard labelKey="pages.bossRoom.breakEven" value={mad(0)} /><StatCard labelKey="pages.bossRoom.riskThreshold" value="12%" /><StatCard labelKey="pages.bossRoom.access" value={<T k="pages.bossRoom.bossOnly" />} /></div>
      <section className="mt-6 rounded-lg border border-black/10 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-mint"><T k="pages.auditHistory.bossEyebrow" /></p>
            <h2 className="mt-2 text-2xl font-semibold text-ink"><T k="pages.auditHistory.bossTitle" /></h2>
          </div>
          <a className="rounded-md border border-black/10 px-3 py-2 text-sm font-semibold" href="/audit-history"><T k="pages.auditHistory.openFull" /></a>
        </div>
        <div className="mt-4 grid gap-3">
          {auditLogs.map((log) => (
            <div className="rounded-md border border-black/10 p-3" key={log.id}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-semibold">{log.module ?? log.entity} / {log.actionType ?? log.action}</p>
                <p className="text-xs text-stone-500">{log.createdAt.toLocaleString()}</p>
              </div>
              <p className="mt-1 text-sm text-stone-600">{log.changeSummary ?? log.recordLabel ?? log.entityId ?? "-"}</p>
              <p className="mt-1 text-xs text-stone-500">{log.performedByName ?? log.actor?.name ?? "-"}</p>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
