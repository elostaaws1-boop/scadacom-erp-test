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

  return allowed ? { ok: true } : { ok: false, error: "Passcode is incorrect." };
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
  const [projects, reports] = await Promise.all([
    prisma.project.findMany({ orderBy: { name: "asc" } }),
    prisma.monthlyPerformanceReport.findMany({ orderBy: [{ year: "desc" }, { month: "desc" }], take: 12 })
  ]);
  return (
    <>
      <PageHeader titleKey="pages.bossRoom.title" descriptionKey="pages.bossRoom.description" />
      <BossRoomConsole
        projects={projects}
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
    </>
  );
}
