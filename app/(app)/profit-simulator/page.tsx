import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { PageHeader } from "@/components/page-header";
import { ProfitSimulatorConsole, type ProfitSimulatorState } from "@/components/profit-simulator-console";
import { StatCard } from "@/components/stat-card";
import { mad } from "@/lib/money";
import { prisma } from "@/lib/prisma";
import { hasGlobalProjectAccess, projectControlRoles } from "@/lib/rbac";

async function runSimulator(_state: ProfitSimulatorState, formData: FormData): Promise<ProfitSimulatorState> {
  "use server";
  const session = await auth();
  if (!session?.user || !projectControlRoles.includes(session.user.role)) notFound();

  const revenue = Number(formData.get("revenue") ?? 0);
  const manualCost = Number(formData.get("manualCost") ?? 0);
  if (!Number.isFinite(revenue) || !Number.isFinite(manualCost) || revenue < 0 || manualCost < 0) {
    return { error: "Revenue and cost must be positive numbers." };
  }

  const totalCost = manualCost;
  const profit = revenue - totalCost;
  const marginPercent = revenue ? (profit / revenue) * 100 : 0;
  const recommendedPricing = totalCost * 1.25;
  const status = profit < 0 ? "LOSS" : marginPercent < 12 ? "RISKY" : "PROFITABLE";
  const projectId = String(formData.get("projectId") ?? "");
  let saved = false;

  if (projectId) {
    const project = await prisma.project.findFirst({
      where: hasGlobalProjectAccess(session.user.role)
        ? { id: projectId }
        : { id: projectId, assignments: { some: { userId: session.user.id } } },
      select: { id: true }
    });
    if (!project) return { error: "You do not have access to save a scenario for that project." };

    await prisma.profitScenario.create({
      data: {
        projectId,
        name: String(formData.get("name") || "Scenario"),
        revenue,
        manualCost,
        totalCost,
        profit,
        marginPercent,
        breakEven: totalCost,
        recommendedPricing,
        status,
        createdById: session.user.id
      }
    });
    saved = true;
  }

  return { result: { profit, marginPercent, breakEven: totalCost, recommendedPricing, status, saved } };
}

export default async function ProfitSimulatorPage() {
  const session = await auth();
  if (!session?.user || !projectControlRoles.includes(session.user.role)) notFound();

  const projects = await prisma.project.findMany({
    where: hasGlobalProjectAccess(session.user.role) ? undefined : { assignments: { some: { userId: session.user.id } } },
    orderBy: { name: "asc" },
    select: { id: true, name: true }
  });

  return (
    <>
      <PageHeader title="Profit Simulator" description="Model revenue, cost, margin, break-even, and recommended pricing before saving a scenario to a project." />
      <ProfitSimulatorConsole projects={projects} run={runSimulator} />
      <div className="mt-6 grid gap-4 md:grid-cols-4">
        <StatCard label="Target margin" value="25%" />
        <StatCard label="Break-even" value={mad(0)} />
        <StatCard label="Risk threshold" value="12%" />
        <StatCard label="Access" value="Boss, GM, PM" />
      </div>
    </>
  );
}
