import Link from "next/link";
import { deactivateTeam, deleteOrArchiveTeam } from "@/app/actions";
import { PageHeader } from "@/components/page-header";
import { TeamForm } from "@/components/team-form";
import { auth } from "@/auth";
import { projectIdsForUser } from "@/lib/access";
import { getTranslator } from "@/lib/i18n-server";
import { mad, toNumber } from "@/lib/money";
import { prisma } from "@/lib/prisma";

const activeMissionStatuses = ["PLANNED", "ACTIVE", "IN_PROGRESS", "ON_MISSION"];

function statusClass(status: string) {
  if (status === "ON_MISSION") return "bg-blue-100 text-blue-800";
  if (status === "ASSIGNED") return "bg-amber-100 text-amber-800";
  if (status === "INACTIVE") return "bg-stone-200 text-stone-700";
  return "bg-emerald-100 text-emerald-800";
}

export default async function TeamsPage() {
  const session = await auth();
  const user = session?.user;
  const { t } = await getTranslator();
  const scopedProjectIds = user ? await projectIdsForUser(user) : [];
  const teamWhere = scopedProjectIds
    ? {
        OR: [
          { projectId: { in: scopedProjectIds } },
          { missions: { some: { projectId: { in: scopedProjectIds } } } },
          { projectId: null, missions: { none: {} } }
        ]
      }
    : {};

  const [teams, employees, vehicles, projects] = await Promise.all([
    prisma.team.findMany({
      where: teamWhere,
      include: {
        members: { include: { employee: true }, orderBy: { employee: { fullName: "asc" } } },
        missions: {
          include: {
            project: true,
            vehicle: { include: { driver: true } },
            purchases: true,
            expenses: true,
            advances: true
          },
          orderBy: { startDate: "desc" }
        }
      },
      orderBy: { name: "asc" }
    }),
    prisma.employee.findMany({ where: { active: true }, orderBy: { fullName: "asc" }, include: { vehicle: true } }),
    prisma.vehicle.findMany({ orderBy: { plate: "asc" }, include: { driver: true } }),
    prisma.project.findMany({ where: { status: { in: ["PLANNED", "ACTIVE", "ON_HOLD"] } }, orderBy: { name: "asc" } })
  ]);

  const employeeById = new Map(employees.map((employee) => [employee.id, employee]));
  const vehicleById = new Map(vehicles.map((vehicle) => [vehicle.id, vehicle]));
  const projectById = new Map(projects.map((project) => [project.id, project]));
  const assignedVehicleTeam = new Map(
    teams
      .filter((team) => team.vehicleId && ["ASSIGNED", "ON_MISSION"].includes(team.status))
      .map((team) => [team.vehicleId, team.name])
  );

  const leaders = employees
    .filter((employee) => employee.role === "TEAM_LEADER")
    .map((employee) => ({ id: employee.id, label: employee.fullName, meta: employee.phone ?? undefined }));
  const technicians = employees
    .filter((employee) => employee.role === "TECHNICIAN")
    .map((employee) => ({ id: employee.id, label: employee.fullName, meta: employee.phone ?? undefined }));
  const drivers = employees.map((employee) => ({
    id: employee.id,
    label: employee.fullName,
    meta: employee.vehicle ? `${employee.vehicle.plate} ${employee.vehicle.model}` : t(roleLabelKey(employee.role))
  }));
  const vehicleOptions = vehicles.map((vehicle) => ({
    id: vehicle.id,
    label: `${vehicle.plate} - ${vehicle.model}`,
    meta: vehicle.driver?.fullName,
    assignedTeam: assignedVehicleTeam.get(vehicle.id) ?? null
  }));
  const projectOptions = projects.map((project) => ({ id: project.id, label: project.name, meta: project.siteId }));
  const canManage = user ? ["BOSS", "GENERAL_MANAGER", "SUPER_ADMIN", "ADMIN"].includes(user.role) : false;
  const canDelete = user ? ["BOSS", "SUPER_ADMIN"].includes(user.role) : false;

  return (
    <>
      <PageHeader titleKey="pages.teams.title" descriptionKey="pages.teams.description" />

      {canManage ? (
        <TeamForm leaders={leaders} technicians={technicians} drivers={drivers} vehicles={vehicleOptions} projects={projectOptions} canOverrideVehicle={canManage} />
      ) : null}

      <div className="grid gap-4 xl:grid-cols-2">
        {teams.length === 0 ? (
          <section className="rounded-lg border border-black/10 bg-white p-5 text-sm text-stone-600 shadow-sm">{t("pages.teams.empty")}</section>
        ) : teams.map((team) => {
          const activeMission = team.missions.find((mission) => activeMissionStatuses.includes(mission.status));
          const leader = team.leaderId ? employeeById.get(team.leaderId) : null;
          const driver = team.driverId ? employeeById.get(team.driverId) : activeMission?.vehicle?.driver ?? null;
          const vehicle = team.vehicleId ? vehicleById.get(team.vehicleId) : activeMission?.vehicle ?? null;
          const project = team.projectId ? projectById.get(team.projectId) : activeMission?.project ?? null;
          const displayStatus = activeMission ? "ON_MISSION" : team.status;
          const approvedPurchases = team.missions.flatMap((mission) => mission.purchases).filter((purchase) => purchase.status === "APPROVED" || purchase.status === "PARTIALLY_APPROVED");
          const approvedExpenses = team.missions.flatMap((mission) => mission.expenses).filter((expense) => expense.status === "APPROVED" || expense.status === "PARTIALLY_APPROVED");
          const pendingActions = team.missions.reduce((count, mission) => {
            return count + mission.purchases.filter((item) => item.status === "PENDING").length + mission.expenses.filter((item) => item.status === "PENDING").length + mission.advances.filter((item) => item.status === "PENDING").length;
          }, 0);
          const approvedTotal = approvedPurchases.reduce((sum, item) => sum + toNumber(item.approvedAmount ?? item.amount), 0) + approvedExpenses.reduce((sum, item) => sum + toNumber(item.approvedAmount ?? item.amount), 0);

          return (
            <section className="rounded-lg border border-black/10 bg-white p-5 shadow-sm" key={team.id}>
              <div className="flex flex-col justify-between gap-3 md:flex-row md:items-start">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-xl font-semibold text-ink">{team.name}</h2>
                    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusClass(displayStatus)}`}>
                      {t(teamStatusLabelKey(displayStatus))}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-stone-600">{team.notes || t("pages.teams.noNotes")}</p>
                </div>
                <Link href={`/teams/${team.id}`} className="rounded-md border border-black/10 px-3 py-2 text-center text-sm font-semibold text-ink">
                  {t("pages.teams.viewTeam")}
                </Link>
              </div>

              <dl className="mt-4 grid gap-3 text-sm md:grid-cols-2">
                <Info label={t("pages.teams.teamLeader")} value={leader?.fullName ?? t("pages.teams.noLeader")} />
                <Info label={t("pages.teams.technicianCount")} value={String(team.members.length)} />
                <Info label={t("pages.teams.driver")} value={driver?.fullName ?? t("common.empty.noDriver")} />
                <Info label={t("pages.teams.assignedVehicle")} value={vehicle ? `${vehicle.plate} - ${vehicle.model}` : t("pages.teams.noVehicleAssigned")} />
                <Info label={t("pages.teams.assignedProject")} value={project ? `${project.name} (${project.siteId})` : t("common.empty.noProject")} />
                <Info label={t("pages.teams.activeMission")} value={activeMission?.title ?? t("pages.teams.noActiveMission")} />
                <Info label={t("pages.teams.pendingActions")} value={String(pendingActions)} />
                <Info label={t("pages.teams.approvedTeamCost")} value={mad(approvedTotal)} />
              </dl>

              {canManage ? (
                <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                  <form action={deactivateTeam}>
                    <input type="hidden" name="id" value={team.id} />
                    <button className="w-full rounded-md border border-black/10 px-3 py-2 text-sm font-semibold text-ink sm:w-auto">{t("pages.teams.deactivate")}</button>
                  </form>
                  {canDelete ? (
                    <form action={deleteOrArchiveTeam}>
                      <input type="hidden" name="id" value={team.id} />
                      <button className="w-full rounded-md border border-red-200 px-3 py-2 text-sm font-semibold text-red-700 sm:w-auto">{t("pages.teams.archiveDelete")}</button>
                    </form>
                  ) : null}
                </div>
              ) : null}
            </section>
          );
        })}
      </div>
    </>
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

function roleLabelKey(role: string) {
  const map: Record<string, string> = {
    BOSS: "roles.boss",
    GENERAL_MANAGER: "roles.generalManager",
    FINANCIAL_DEPARTMENT: "roles.financialDepartment",
    PROJECT_MANAGER: "roles.projectManager",
    TEAM_LEADER: "roles.teamLeader",
    TECHNICIAN: "roles.technician",
    WAREHOUSE_MANAGER: "roles.warehouseManager",
    FLEET_MANAGER: "roles.fleetManager",
    SUPER_ADMIN: "roles.superAdmin",
    ADMIN: "roles.admin",
    ACCOUNTANT: "roles.accountant"
  };
  return map[role] ?? "roles.technician";
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
