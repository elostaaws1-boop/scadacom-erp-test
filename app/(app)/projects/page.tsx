import { Plus } from "lucide-react";
import { ApprovalStatus, Role } from "@prisma/client";
import { auth } from "@/auth";
import { PageHeader } from "@/components/page-header";
import { DataTable } from "@/components/data-table";
import { StatusBadge } from "@/components/status-badge";
import { T } from "@/components/translated-text";
import { projectScopeWhere } from "@/lib/access";
import { getTranslator } from "@/lib/i18n-server";
import { mad } from "@/lib/money";
import { prisma } from "@/lib/prisma";

export default async function ProjectsPage() {
  const session = await auth();
  const { t, locale } = await getTranslator();
  const projects = await prisma.project.findMany({
    where: await projectScopeWhere(session!.user),
    orderBy: { createdAt: "desc" },
    include: {
      assignments: { include: { user: true } },
      vehicles: { include: { driver: true } },
      missions: {
        include: {
          team: { include: { members: { include: { employee: true } } } },
          vehicle: true
        }
      },
      purchases: true,
      expenses: true,
      advances: true
    }
  });
  const snapshots = projects.map(toProjectSnapshot);

  return (
    <>
      <PageHeader
        titleKey="pages.projects.title"
        descriptionKey="pages.projects.description"
        action={<a className="inline-flex items-center gap-2 rounded-md bg-ink px-4 py-2 text-sm font-semibold text-white" href="/projects/new"><Plus size={16} /> <T k="pages.projects.new" /></a>}
      />

      <div className="grid gap-4 md:hidden">
        {snapshots.map((snapshot) => (
          <article className="rounded-lg border border-black/10 bg-white p-4 shadow-sm" key={snapshot.id}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-ink">{snapshot.name}</h2>
                <p className="mt-1 text-sm text-stone-600">{snapshot.client} / {snapshot.siteId}</p>
                <p className="text-sm text-stone-600">{snapshot.region}</p>
              </div>
              <StatusBadge status={snapshot.status} />
            </div>
            <div className="mt-4 grid gap-2 text-sm">
              <MobileLine label={t("pages.projects.workType")} value={`${snapshot.workType} / ${snapshot.technology}`} />
              <MobileLine label={t("pages.projects.dates")} value={`${dateLabel(snapshot.startDate, locale)} - ${snapshot.endDate ? dateLabel(snapshot.endDate, locale) : t("common.empty.none")}`} />
              <MobileLine label={t("pages.projects.projectManager")} value={snapshot.projectManager ?? t("common.empty.none")} />
              <MobileLine label={t("pages.projects.team")} value={snapshot.teamName ? `${snapshot.teamName} (${snapshot.teamMemberCount})` : t("pages.projects.noTeam")} />
              <MobileLine label={t("pages.projects.vehicle")} value={snapshot.vehicleLabel ?? t("pages.projects.noVehicle")} />
              <MobileLine label={t("pages.projects.activeMissions")} value={snapshot.activeMissionCount} />
              <MobileLine label={t("pages.projects.approvedPurchases")} value={mad(snapshot.approvedPurchasesTotal)} />
              <MobileLine label={t("pages.projects.approvedExpenses")} value={mad(snapshot.approvedExpensesTotal)} />
              <MobileLine label={t("pages.projects.remainingBudget")} value={mad(snapshot.remainingBudget)} />
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <Pill label={t("pages.projects.pendingAdvances")} value={snapshot.pendingAdvances} tone={snapshot.pendingAdvances ? "warning" : "neutral"} />
              <Pill label={t("pages.projects.pendingPurchases")} value={snapshot.pendingPurchases} tone={snapshot.pendingPurchases ? "warning" : "neutral"} />
              <Pill label={t("pages.projects.marginRisk")} value={t(snapshot.riskLabelKey)} tone={snapshot.riskTone} />
            </div>
            <a className="mt-4 inline-flex w-full justify-center rounded-md bg-ink px-4 py-2 text-sm font-semibold text-white" href={`/projects/${snapshot.id}`}>
              {t("pages.projects.viewDetails")}
            </a>
          </article>
        ))}
      </div>

      <div className="hidden md:block">
        <DataTable>
          <table className="w-full min-w-[1280px] text-left text-sm">
            <thead className="bg-field text-xs uppercase text-stone-500">
              <tr>
                <th className="px-4 py-3"><T k="pages.projects.tableProject" /></th>
                <th><T k="pages.projects.client" /></th>
                <th><T k="pages.projects.workType" /></th>
                <th><T k="pages.projects.dates" /></th>
                <th><T k="pages.projects.projectManager" /></th>
                <th><T k="pages.projects.team" /></th>
                <th><T k="pages.projects.vehicle" /></th>
                <th><T k="pages.projects.missions" /></th>
                <th><T k="pages.projects.pending" /></th>
                <th><T k="pages.projects.costs" /></th>
                <th><T k="pages.projects.remaining" /></th>
                <th><T k="pages.projects.marginRisk" /></th>
              </tr>
            </thead>
            <tbody>
              {snapshots.map((snapshot) => (
                <tr className="border-t border-black/10 align-top" key={snapshot.id}>
                  <td className="px-4 py-3">
                    <a className="font-semibold text-mint" href={`/projects/${snapshot.id}`}>{snapshot.name}</a>
                    <div className="text-xs text-stone-500">{snapshot.region} / {snapshot.siteId}</div>
                    <div className="mt-1"><StatusBadge status={snapshot.status} /></div>
                  </td>
                  <td>{snapshot.client}</td>
                  <td>{snapshot.workType}<div className="text-xs text-stone-500">{snapshot.technology}</div></td>
                  <td>{dateLabel(snapshot.startDate, locale)}<div className="text-xs text-stone-500">{snapshot.endDate ? dateLabel(snapshot.endDate, locale) : t("common.empty.none")}</div></td>
                  <td>{snapshot.projectManager ?? t("common.empty.none")}</td>
                  <td>{snapshot.teamName ?? t("pages.projects.noTeam")}<div className="text-xs text-stone-500">{snapshot.teamMemberCount} {t("pages.projects.members")}</div></td>
                  <td>{snapshot.vehicleLabel ?? t("pages.projects.noVehicle")}</td>
                  <td>{snapshot.activeMissionCount}</td>
                  <td>
                    <Pill label={t("pages.projects.advancesShort")} value={snapshot.pendingAdvances} tone={snapshot.pendingAdvances ? "warning" : "neutral"} />
                    <div className="mt-1"><Pill label={t("pages.projects.purchasesShort")} value={snapshot.pendingPurchases} tone={snapshot.pendingPurchases ? "warning" : "neutral"} /></div>
                  </td>
                  <td>{mad(snapshot.approvedPurchasesTotal + snapshot.approvedExpensesTotal)}<div className="text-xs text-stone-500">{t("pages.projects.pendingCost")}: {mad(snapshot.pendingCost)}</div></td>
                  <td>{mad(snapshot.remainingBudget)}</td>
                  <td><Pill label={t(snapshot.riskLabelKey)} value={`${snapshot.margin.toFixed(1)}%`} tone={snapshot.riskTone} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </DataTable>
      </div>
    </>
  );
}

function toProjectSnapshot(project: Awaited<ReturnType<typeof prisma.project.findMany>>[number] & {
  assignments: Array<{ user: { role: Role; name: string } }>;
  vehicles: Array<{ plate: string; model: string; driver?: { fullName: string } | null }>;
  missions: Array<{ status: string; team: { name: string; members: Array<{ employee: { fullName: string } }> }; vehicle?: { plate: string; model: string } | null }>;
  purchases: Array<{ status: ApprovalStatus; amount: unknown; approvedAmount: unknown }>;
  expenses: Array<{ status: ApprovalStatus; amount: unknown; approvedAmount: unknown }>;
  advances: Array<{ status: ApprovalStatus }>;
}) {
  const approvedPurchasesTotal = project.purchases.filter(isApproved).reduce((sum, item) => sum + approvedAmount(item), 0);
  const approvedExpensesTotal = project.expenses.filter(isApproved).reduce((sum, item) => sum + approvedAmount(item), 0);
  const pendingPurchases = project.purchases.filter((item) => item.status === ApprovalStatus.PENDING).length;
  const pendingAdvances = project.advances.filter((item) => item.status === ApprovalStatus.PENDING).length;
  const pendingCost =
    project.purchases.filter((item) => item.status === ApprovalStatus.PENDING).reduce((sum, item) => sum + Number(item.amount), 0) +
    project.expenses.filter((item) => item.status === ApprovalStatus.PENDING).reduce((sum, item) => sum + Number(item.amount), 0);
  const actualCost = approvedPurchasesTotal + approvedExpensesTotal;
  const remainingBudget = Number(project.allocatedBudget) - actualCost;
  const profit = Number(project.contractValue) - actualCost;
  const margin = Number(project.contractValue) ? (profit / Number(project.contractValue)) * 100 : 0;
  const riskTone = (profit < 0 ? "critical" : margin < 12 ? "warning" : "good") as "critical" | "warning" | "good";
  const team = project.missions[0]?.team;
  const vehicle = project.vehicles[0] ?? project.missions.find((mission) => mission.vehicle)?.vehicle;

  return {
    id: project.id,
    name: project.name,
    client: formatEnum(project.client),
    siteId: project.siteId,
    region: project.region,
    workType: formatEnum(project.workType),
    technology: formatEnum(project.technology),
    status: project.status,
    startDate: project.startDate,
    endDate: project.endDate,
    projectManager: project.assignments.find((assignment) => assignment.user.role === Role.PROJECT_MANAGER)?.user.name,
    teamName: team?.name,
    teamMemberCount: team?.members.length ?? 0,
    vehicleLabel: vehicle ? `${vehicle.plate} / ${vehicle.model}` : null,
    activeMissionCount: project.missions.filter((mission) => mission.status !== "COMPLETED" && mission.status !== "CANCELLED").length,
    pendingAdvances,
    pendingPurchases,
    approvedPurchasesTotal,
    approvedExpensesTotal,
    pendingCost,
    remainingBudget,
    margin,
    riskLabelKey: riskTone === "critical" ? "pages.projects.risk.loss" : riskTone === "warning" ? "pages.projects.risk.warning" : "pages.projects.risk.healthy",
    riskTone
  };
}

function MobileLine({ label, value }: { label: string; value: React.ReactNode }) {
  return <div className="flex justify-between gap-3 border-b border-black/10 py-2"><span className="text-stone-500">{label}</span><span className="text-end font-medium text-ink">{value}</span></div>;
}

function Pill({ label, value, tone }: { label: string; value: React.ReactNode; tone: "neutral" | "warning" | "critical" | "good" }) {
  const classes = tone === "critical" ? "bg-red-50 text-red-700" : tone === "warning" ? "bg-amber-50 text-amber-700" : tone === "good" ? "bg-emerald-50 text-emerald-700" : "bg-stone-100 text-stone-700";
  return <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold ${classes}`}><span>{label}</span><span>{value}</span></span>;
}

function isApproved(item: { status: ApprovalStatus }) {
  return item.status === ApprovalStatus.APPROVED || item.status === ApprovalStatus.PARTIALLY_APPROVED;
}

function approvedAmount(item: { amount: unknown; approvedAmount: unknown }) {
  return Number(item.approvedAmount ?? item.amount);
}

function formatEnum(value: string) {
  return value.replaceAll("_", " ");
}

function dateLabel(date: Date, locale: string) {
  return date.toLocaleDateString(locale === "ar" ? "ar" : locale === "fr" ? "fr" : "en");
}
