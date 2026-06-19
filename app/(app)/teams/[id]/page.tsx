import Link from "next/link";
import type React from "react";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { auth } from "@/auth";
import { projectIdsForUser } from "@/lib/access";
import { getTranslator } from "@/lib/i18n-server";
import { mad, toNumber } from "@/lib/money";
import { prisma } from "@/lib/prisma";

const activeMissionStatuses = ["PLANNED", "ACTIVE", "IN_PROGRESS", "ON_MISSION"];

export default async function TeamDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  const user = session?.user;
  if (!user) notFound();
  const { t } = await getTranslator();

  const team = await prisma.team.findUnique({
    where: { id },
    include: {
      members: { include: { employee: true }, orderBy: { employee: { fullName: "asc" } } },
      missions: {
        include: {
          project: true,
          vehicle: { include: { driver: true } },
          technicians: { include: { employee: true } },
          allowances: true,
          purchases: { include: { project: true } },
          expenses: { include: { project: true } },
          advances: { include: { project: true } }
        },
        orderBy: { startDate: "desc" }
      }
    }
  });
  if (!team) notFound();

  const [employees, vehicle, project] = await Promise.all([
    prisma.employee.findMany({ where: { id: { in: [team.leaderId, team.driverId].filter(Boolean) as string[] } } }),
    team.vehicleId ? prisma.vehicle.findUnique({ where: { id: team.vehicleId }, include: { driver: true } }) : null,
    team.projectId ? prisma.project.findUnique({ where: { id: team.projectId } }) : null
  ]);
  const employeeById = new Map(employees.map((employee) => [employee.id, employee]));
  const leader = team.leaderId ? employeeById.get(team.leaderId) : null;
  const driver = team.driverId ? employeeById.get(team.driverId) : vehicle?.driver ?? null;
  const activeMission = team.missions.find((mission) => activeMissionStatuses.includes(mission.status));
  const visibleProjectIds = await projectIdsForUser(user);
  const canSee =
    visibleProjectIds === undefined ||
    (team.projectId ? visibleProjectIds.includes(team.projectId) : false) ||
    team.missions.some((mission) => visibleProjectIds.includes(mission.projectId)) ||
    (user.role === "TEAM_LEADER" && leader?.userId === user.id) ||
    (user.role === "TECHNICIAN" && team.members.some((member) => member.employee.userId === user.id));
  if (!canSee) notFound();

  const missionPurchases = team.missions.flatMap((mission) => mission.purchases);
  const missionExpenses = team.missions.flatMap((mission) => mission.expenses);
  const missionAdvances = team.missions.flatMap((mission) => mission.advances);
  const allowancesTotal = team.missions.flatMap((mission) => mission.allowances).reduce((sum, item) => sum + toNumber(item.totalMad), 0);
  const approvedPurchases = missionPurchases.filter((item) => item.status === "APPROVED" || item.status === "PARTIALLY_APPROVED");
  const approvedExpenses = missionExpenses.filter((item) => item.status === "APPROVED" || item.status === "PARTIALLY_APPROVED");
  const approvedPurchaseTotal = approvedPurchases.reduce((sum, item) => sum + toNumber(item.approvedAmount ?? item.amount), 0);
  const approvedExpenseTotal = approvedExpenses.reduce((sum, item) => sum + toNumber(item.approvedAmount ?? item.amount), 0);

  return (
    <>
      <PageHeader
        title={team.name}
        description={`${t("pages.teams.detailDescription")} ${team.status ? t(teamStatusLabelKey(activeMission ? "ON_MISSION" : team.status)) : ""}`}
        action={<Link href="/teams" className="rounded-md border border-black/10 px-3 py-2 text-sm font-semibold text-ink">{t("pages.teams.backToTeams")}</Link>}
      />

      <div className="grid gap-5">
        <Section title={t("pages.teams.sections.overview")}>
          <Info label={t("pages.teams.teamName")} value={team.name} />
          <Info label={t("common.fields.status")} value={t(teamStatusLabelKey(activeMission ? "ON_MISSION" : team.status))} />
          <Info label={t("pages.teams.assignedProject")} value={project ? `${project.name} (${project.siteId})` : activeMission?.project.name ?? t("common.empty.noProject")} />
          <Info label={t("pages.teams.assignedVehicle")} value={vehicle ? `${vehicle.plate} - ${vehicle.model}` : activeMission?.vehicle ? `${activeMission.vehicle.plate} - ${activeMission.vehicle.model}` : t("pages.teams.noVehicleAssigned")} />
          <Info label={t("common.fields.notes")} value={team.notes || t("pages.teams.noNotes")} />
        </Section>

        <Section title={t("pages.teams.sections.members")}>
          <Info label={t("pages.teams.teamLeader")} value={leader ? contactLine(leader.fullName, leader.phone) : t("pages.teams.noLeader")} />
          <Info label={t("pages.teams.driver")} value={driver ? contactLine(driver.fullName, driver.phone) : t("common.empty.noDriver")} />
          <div className="md:col-span-2">
            <h3 className="mb-2 text-sm font-semibold text-stone-700">{t("pages.teams.technicians")}</h3>
            {team.members.length === 0 ? (
              <p className="rounded-md bg-stone-50 px-3 py-3 text-sm text-stone-600">{t("common.empty.noMembers")}</p>
            ) : (
              <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                {team.members.map((member) => (
                  <div className="rounded-md bg-stone-50 px-3 py-2 text-sm" key={member.id}>
                    <p className="font-semibold text-ink">{member.employee.fullName}</p>
                    <p className="text-stone-600">{member.employee.phone || t("common.empty.noContact")}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Section>

        <Section title={t("pages.teams.sections.missions")}>
          {team.missions.length === 0 ? (
            <p className="md:col-span-2 rounded-md bg-stone-50 px-3 py-3 text-sm text-stone-600">{t("pages.teams.noMissions")}</p>
          ) : team.missions.map((mission) => (
            <div className="rounded-md border border-black/10 p-3 text-sm" key={mission.id}>
              <p className="font-semibold text-ink">{mission.title}</p>
              <p className="text-stone-600">{mission.project.name} - {mission.location}</p>
              <p className="mt-1 text-stone-600">{dateText(mission.startDate)} {mission.endDate ? `- ${dateText(mission.endDate)}` : ""}</p>
              <span className="mt-2 inline-flex rounded-full bg-stone-100 px-2 py-1 text-xs font-semibold text-stone-700">{mission.status}</span>
            </div>
          ))}
        </Section>

        <Section title={t("pages.teams.sections.costs")}>
          <Info label={t("pages.teams.deploymentAllowances")} value={mad(allowancesTotal)} />
          <Info label={t("pages.teams.approvedPurchases")} value={mad(approvedPurchaseTotal)} />
          <Info label={t("pages.teams.approvedExpenses")} value={mad(approvedExpenseTotal)} />
          <Info label={t("pages.teams.advanceRequests")} value={String(missionAdvances.length)} />
        </Section>
      </div>
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-black/10 bg-white p-5 shadow-sm">
      <h2 className="text-lg font-semibold text-ink">{title}</h2>
      <div className="mt-4 grid gap-3 md:grid-cols-2">{children}</div>
    </section>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-stone-50 px-3 py-2">
      <dt className="text-xs uppercase tracking-wide text-stone-500">{label}</dt>
      <dd className="mt-1 font-medium text-ink">{value}</dd>
    </div>
  );
}

function contactLine(name: string, phone?: string | null) {
  return phone ? `${name} - ${phone}` : name;
}

function dateText(date: Date) {
  return new Intl.DateTimeFormat("fr-MA", { dateStyle: "medium" }).format(date);
}

function teamStatusLabelKey(status: string) {
  const map: Record<string, string> = {
    AVAILABLE: "pages.teams.status.AVAILABLE",
    ASSIGNED: "pages.teams.status.ASSIGNED",
    ON_MISSION: "pages.teams.status.ON_MISSION",
    INACTIVE: "pages.teams.status.INACTIVE"
  };
  return map[status] ?? "pages.teams.status.AVAILABLE";
}
