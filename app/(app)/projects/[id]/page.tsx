import { ApprovalStatus } from "@prisma/client";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { StatusBadge } from "@/components/status-badge";
import { T } from "@/components/translated-text";
import { canAccessProject } from "@/lib/access";
import { projectCostSummary } from "@/lib/business";
import { getTranslator } from "@/lib/i18n-server";
import { mad } from "@/lib/money";
import { prisma } from "@/lib/prisma";

export default async function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  const { t, locale } = await getTranslator();
  if (!session?.user || !(await canAccessProject(session.user, id))) notFound();

  const [summary, project] = await Promise.all([
    projectCostSummary(id).catch(() => null),
    prisma.project.findUnique({
      where: { id },
      include: {
        assignments: { include: { user: true } },
        vehicles: { include: { driver: true } },
        missions: {
          orderBy: { startDate: "desc" },
          include: {
            team: { include: { members: { include: { employee: true } } } },
            vehicle: { include: { driver: true } },
            technicians: { include: { employee: true } }
          }
        },
        purchases: { orderBy: { createdAt: "desc" }, include: { receipts: true } },
        expenses: { orderBy: { createdAt: "desc" }, include: { receipts: true } },
        advances: { orderBy: { createdAt: "desc" } },
        stockMoves: { orderBy: { createdAt: "desc" } }
      }
    })
  ]);

  if (!summary || !project) notFound();

  const approvedPurchases = project.purchases.filter(isApproved);
  const approvedExpenses = project.expenses.filter(isApproved);
  const pendingPurchases = project.purchases.filter((item) => item.status === ApprovalStatus.PENDING);
  const pendingExpenses = project.expenses.filter((item) => item.status === ApprovalStatus.PENDING);
  const pendingAdvances = project.advances.filter((item) => item.status === ApprovalStatus.PENDING);
  const pendingCost = pendingPurchases.reduce((sum, item) => sum + Number(item.amount), 0) + pendingExpenses.reduce((sum, item) => sum + Number(item.amount), 0);
  const margin = Number(project.contractValue) ? ((Number(project.contractValue) - summary.actualCost) / Number(project.contractValue)) * 100 : 0;
  const activeMissions = project.missions.filter((mission) => mission.status !== "COMPLETED" && mission.status !== "CANCELLED");
  const primaryTeam = project.missions[0]?.team;
  const primaryVehicle = project.vehicles[0] ?? project.missions.find((mission) => mission.vehicle)?.vehicle;
  const documents = [
    ...project.purchases.flatMap((purchase) => purchase.receipts.map((receipt) => ({ id: receipt.id, name: receipt.fileName, module: t("pages.projects.purchases"), amount: Number(receipt.costMad) }))),
    ...project.expenses.flatMap((expense) => expense.receipts.map((receipt) => ({ id: receipt.id, name: receipt.fileName, module: t("pages.projects.expenses"), amount: Number(receipt.costMad) })))
  ];

  return (
    <>
      <PageHeader title={project.name} description={`${project.region} / ${project.siteId} / ${formatEnum(project.workType)}`} action={<StatusBadge status={project.status} />} />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <StatCard labelKey="pages.projects.contractValue" value={mad(project.contractValue)} />
        <StatCard labelKey="pages.projects.allocatedBudget" value={mad(project.allocatedBudget)} />
        <StatCard labelKey="pages.projects.actualApprovedCost" value={mad(summary.actualCost)} />
        <StatCard labelKey="pages.projects.pendingCost" value={mad(pendingCost)} />
        <StatCard labelKey="pages.bossRoom.margin" value={`${margin.toFixed(1)}%`} />
      </div>

      <div className="mt-6 grid gap-5">
        <DetailSection title={t("pages.projects.sections.overview")}>
          <DetailGrid>
            <KeyValue label={t("pages.projects.client")} value={formatEnum(project.client)} />
            <KeyValue label={t("pages.projects.siteId")} value={project.siteId} />
            <KeyValue label={t("pages.projects.region")} value={project.region} />
            <KeyValue label={t("pages.projects.workType")} value={formatEnum(project.workType)} />
            <KeyValue label={t("pages.projects.technology")} value={formatEnum(project.technology)} />
            <KeyValue label={t("pages.projects.dates")} value={`${dateLabel(project.startDate, locale)} - ${project.endDate ? dateLabel(project.endDate, locale) : t("common.empty.none")}`} />
          </DetailGrid>
        </DetailSection>

        <DetailSection title={t("pages.projects.sections.team")}>
          {primaryTeam ? (
            <div className="space-y-3">
              <KeyValue label={t("pages.projects.assignedTeam")} value={`${primaryTeam.name} (${primaryTeam.members.length})`} />
              <div className="grid gap-2 md:grid-cols-2">
                {primaryTeam.members.map((member) => (
                  <div className="rounded-md border border-black/10 p-3" key={member.employee.id}>
                    <p className="font-semibold">{member.employee.fullName}</p>
                    <p className="text-sm text-stone-600">{formatEnum(member.employee.role)}</p>
                    <p className="text-sm text-stone-500">{member.employee.phone ?? t("common.empty.noContact")}</p>
                  </div>
                ))}
              </div>
            </div>
          ) : <EmptyState text={t("pages.projects.noTeam")} />}
        </DetailSection>

        <DetailSection title={t("pages.projects.sections.missions")}>
          {project.missions.length ? <RecordList rows={project.missions.map((mission) => ({
            id: mission.id,
            title: mission.title,
            meta: `${mission.location} / ${mission.team.name}`,
            value: `${dateLabel(mission.startDate, locale)} - ${mission.endDate ? dateLabel(mission.endDate, locale) : t("common.empty.none")}`,
            status: mission.status
          }))} /> : <EmptyState text={t("pages.projects.noMissions")} />}
        </DetailSection>

        <DetailSection title={t("pages.projects.sections.vehicle")}>
          {primaryVehicle ? (
            <DetailGrid>
              <KeyValue label={t("pages.projects.vehiclePlate")} value={primaryVehicle.plate} />
              <KeyValue label={t("pages.projects.vehicleModel")} value={primaryVehicle.model} />
              <KeyValue label={t("pages.projects.driver")} value={primaryVehicle.driver?.fullName ?? t("common.empty.none")} />
              <KeyValue label={t("pages.projects.mileage")} value={`${primaryVehicle.mileage} ${t("common.units.km")}`} />
              <KeyValue label={t("pages.projects.currentLocation")} value={primaryVehicle.googleMapsLink ? <a className="text-mint underline" href={primaryVehicle.googleMapsLink}>{t("pages.projects.openMap")}</a> : t("common.empty.none")} />
              <KeyValue label={t("pages.projects.maintenanceAlerts")} value={[primaryVehicle.oilChangeDue, primaryVehicle.insuranceDue, primaryVehicle.inspectionDue].filter(Boolean).length} />
            </DetailGrid>
          ) : <EmptyState text={t("pages.projects.noVehicle")} />}
        </DetailSection>

        <DetailSection title={t("pages.projects.sections.purchases")}>
          {project.purchases.length ? <RecordList rows={project.purchases.map((purchase) => ({
            id: purchase.id,
            title: purchase.item,
            meta: purchase.category,
            value: mad(purchase.approvedAmount ?? purchase.amount),
            status: purchase.status
          }))} /> : <EmptyState text={t("pages.projects.noPurchases")} />}
        </DetailSection>

        <DetailSection title={t("pages.projects.sections.expenses")}>
          {project.expenses.length ? <RecordList rows={project.expenses.map((expense) => ({
            id: expense.id,
            title: expense.category,
            meta: expense.receipts.length ? t("pages.projects.receiptAttached") : t("pages.projects.receiptMissing"),
            value: mad(expense.approvedAmount ?? expense.amount),
            status: expense.status
          }))} /> : <EmptyState text={t("pages.projects.noExpenses")} />}
        </DetailSection>

        <DetailSection title={t("pages.projects.sections.advances")}>
          {project.advances.length ? <RecordList rows={project.advances.map((advance) => ({
            id: advance.id,
            title: advance.category,
            meta: advance.reason,
            value: mad(advance.amount),
            status: advance.status
          }))} /> : <EmptyState text={t("pages.projects.noAdvances")} />}
        </DetailSection>

        <DetailSection title={t("pages.projects.sections.financial")}>
          <DetailGrid>
            <KeyValue label={t("pages.projects.contractValue")} value={mad(project.contractValue)} />
            <KeyValue label={t("pages.projects.allocatedBudget")} value={mad(project.allocatedBudget)} />
            <KeyValue label={t("pages.projects.approvedPurchases")} value={mad(summary.purchaseCost)} />
            <KeyValue label={t("pages.projects.approvedExpenses")} value={mad(summary.expenseCost)} />
            <KeyValue label={t("pages.approvals.allowanceTitle")} value={mad(summary.allowanceCost)} />
            <KeyValue label={t("pages.projects.pendingCost")} value={mad(pendingCost)} />
            <KeyValue label={t("pages.projects.remainingBudget")} value={mad(summary.remainingBudget)} />
            <KeyValue label={t("pages.bossRoom.margin")} value={`${margin.toFixed(1)}%`} />
          </DetailGrid>
        </DetailSection>

        <DetailSection title={t("pages.projects.sections.documents")}>
          {documents.length ? <RecordList rows={documents.map((document) => ({
            id: document.id,
            title: document.name,
            meta: document.module,
            value: mad(document.amount)
          }))} /> : <EmptyState text={t("pages.projects.noDocuments")} />}
        </DetailSection>

        <section className="rounded-lg border border-black/10 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold"><T k="pages.projects.costRule" /></h2>
          <p className="mt-2 text-sm text-stone-600"><T k="pages.projects.costRuleDescription" /></p>
        </section>
      </div>
    </>
  );
}

function DetailSection({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="rounded-lg border border-black/10 bg-white p-5 shadow-sm"><h2 className="text-xl font-semibold text-ink">{title}</h2><div className="mt-4">{children}</div></section>;
}

function DetailGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{children}</div>;
}

function KeyValue({ label, value }: { label: string; value: React.ReactNode }) {
  return <div className="rounded-md border border-black/10 p-3"><p className="text-xs font-semibold uppercase tracking-[0.12em] text-stone-500">{label}</p><div className="mt-2 font-semibold text-ink">{value}</div></div>;
}

function RecordList({ rows }: { rows: Array<{ id: string; title: string; meta: string; value: React.ReactNode; status?: string }> }) {
  return <div className="grid gap-3">{rows.map((row) => <div className="flex flex-col gap-2 rounded-md border border-black/10 p-3 md:flex-row md:items-center md:justify-between" key={row.id}><div><p className="font-semibold">{row.title}</p><p className="text-sm text-stone-600">{row.meta}</p></div><div className="flex items-center gap-2 md:justify-end"><span className="font-semibold">{row.value}</span>{row.status ? <StatusBadge status={row.status} /> : null}</div></div>)}</div>;
}

function EmptyState({ text }: { text: string }) {
  return <p className="rounded-md border border-dashed border-stone-300 p-4 text-sm text-stone-500">{text}</p>;
}

function isApproved(item: { status: ApprovalStatus }) {
  return item.status === ApprovalStatus.APPROVED || item.status === ApprovalStatus.PARTIALLY_APPROVED;
}

function formatEnum(value: string) {
  return value.replaceAll("_", " ");
}

function dateLabel(date: Date, locale: string) {
  return date.toLocaleDateString(locale === "ar" ? "ar" : locale === "fr" ? "fr" : "en");
}
