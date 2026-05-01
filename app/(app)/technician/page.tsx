import { assignMissionVehicle, requestAdvance, submitExpense } from "@/app/actions";
import { PageHeader } from "@/components/page-header";
import { ReceiptCameraInput } from "@/components/receipt-camera-input";
import { auth } from "@/auth";
import { getTranslator } from "@/lib/i18n-server";
import { prisma } from "@/lib/prisma";

type FieldMission = {
  id: string;
  title: string;
  location: string;
  days: number;
  projectId: string;
  project: { name: string; siteId: string };
  vehicle: { id: string; plate: string; model: string } | null;
};

type Translate = (key: string, values?: Record<string, string | number>) => string;

export default async function TechnicianPage() {
  const { t } = await getTranslator();
  const session = await auth();
  const employee = session?.user.id ? await prisma.employee.findUnique({ where: { userId: session.user.id } }) : null;
  const fieldRole = session?.user.role === "TECHNICIAN" || session?.user.role === "TEAM_LEADER";
  const missionWhere =
    fieldRole && employee
      ? {
          OR: [
            { technicians: { some: { employeeId: employee.id } } },
            ...(session.user.role === "TEAM_LEADER" ? [{ team: { leaderId: employee.id } }] : [])
          ]
        }
      : fieldRole
        ? { id: "__none__" }
        : {};

  const [missions, vehicles] = await Promise.all([
    prisma.mission.findMany({
      where: missionWhere,
      include: { project: true, vehicle: true },
      orderBy: { startDate: "desc" },
      take: 20
    }),
    prisma.vehicle.findMany({ orderBy: { plate: "asc" } })
  ]);
  const projects = Array.from(new Map(missions.map((mission) => [mission.projectId, mission.project])).values());
  const isTeamLeader = session?.user.role === "TEAM_LEADER" || session?.user.role === "SUPER_ADMIN";

  return (
    <>
      <PageHeader titleKey="pages.technician.title" descriptionKey="pages.technician.description" />
      {missions.length === 0 ? (
        <section className="rounded-lg border border-dashed border-stone-300 bg-white p-5 text-sm text-stone-600">
          {t("common.empty.noMissionAssigned")}
        </section>
      ) : null}
      <AssignedMissions missions={missions} t={t} />
      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        {isTeamLeader ? <VehicleAssignment missions={missions} vehicles={vehicles} t={t} /> : null}
        <FieldForm title={t("pages.technician.advanceDemand")} action={requestAdvance} projects={projects} missions={missions} fields="advance" t={t} />
        <FieldForm title={t("pages.technician.expenseReceipts")} action={submitExpense} projects={projects} missions={missions} fields="expense" t={t} />
      </div>
      <p className="mt-4 text-xs text-stone-500">{t("common.messages.signedInAs", { email: session?.user.email ?? "" })}</p>
    </>
  );
}

function AssignedMissions({ missions, t }: { missions: FieldMission[]; t: Translate }) {
  return (
    <section className="rounded-lg border border-black/10 bg-white p-4 shadow-sm">
      <h2 className="text-lg font-semibold">{t("pages.technician.assignedMissions")}</h2>
      <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {missions.map((mission) => (
          <div className="rounded-md border border-black/10 p-3 text-sm" key={mission.id}>
            <p className="font-semibold">{mission.title}</p>
            <p className="mt-1 text-stone-500">{mission.project.name} · {mission.project.siteId}</p>
            <p className="mt-1 text-stone-500">{mission.location} · {mission.days} {t(mission.days === 1 ? "common.units.day" : "common.units.days")}</p>
            <p className="mt-2 font-medium text-ink">{t("pages.technician.vehicle")}: {mission.vehicle ? `${mission.vehicle.plate} · ${mission.vehicle.model}` : t("pages.technician.notAssigned")}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function VehicleAssignment({ missions, vehicles, t }: { missions: FieldMission[]; vehicles: { id: string; plate: string; model: string }[]; t: Translate }) {
  return (
    <form action={assignMissionVehicle} className="rounded-lg border border-black/10 bg-white p-4 shadow-sm">
      <h2 className="text-lg font-semibold">{t("pages.technician.assignVehicle")}</h2>
      <div className="mt-4 grid gap-3">
        <select name="missionId" required className="rounded-md border px-3 py-3">
          {missions.map((mission) => (
            <option value={mission.id} key={mission.id}>{mission.title} · {mission.project.name}</option>
          ))}
        </select>
        <select name="vehicleId" required className="rounded-md border px-3 py-3">
          <option value="">{t("pages.technician.selectVehicle")}</option>
          {vehicles.map((vehicle) => (
            <option value={vehicle.id} key={vehicle.id}>{vehicle.plate} · {vehicle.model}</option>
          ))}
        </select>
        <button className="rounded-md bg-ink px-4 py-3 font-semibold text-white">{t("pages.technician.assignVehicle")}</button>
      </div>
    </form>
  );
}

function FieldForm({
  title,
  action,
  projects,
  missions,
  fields,
  t
}: {
  title: string;
  action: (formData: FormData) => Promise<void>;
  projects: { id: string; name: string }[];
  missions: FieldMission[];
  fields: "advance" | "purchase" | "expense";
  t: Translate;
}) {
  return (
    <form action={action} className="rounded-lg border border-black/10 bg-white p-4 shadow-sm">
      <h2 className="text-lg font-semibold">{title}</h2>
      <div className="mt-4 grid gap-3">
        <select name="projectId" required className="rounded-md border px-3 py-3">
          {projects.map((project) => <option value={project.id} key={project.id}>{project.name}</option>)}
        </select>
        <select name="missionId" required className="rounded-md border px-3 py-3">
          {missions.map((mission) => <option value={mission.id} key={mission.id}>{mission.title} · {mission.project.name}</option>)}
        </select>
        {fields === "purchase" ? <input name="item" required placeholder={t("pages.technician.itemProduct")} className="rounded-md border px-3 py-3" /> : null}
        <input name="category" required placeholder={fields === "advance" ? t("pages.technician.advanceCategory") : t("common.fields.category")} className="rounded-md border px-3 py-3" />
        <input name="amount" type="number" step="0.01" required placeholder={t("common.fields.amountMad")} className="rounded-md border px-3 py-3" />
        {fields === "purchase" ? <select name="paymentMethod" className="rounded-md border px-3 py-3"><option>CASH</option><option>BANK</option><option>CARD</option><option>ADVANCE</option></select> : null}
        {fields !== "advance" ? <ReceiptCameraInput name="receiptPhotos" /> : null}
        {fields === "expense" ? <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="adminOverride" /> {t("pages.technician.adminOverride")}</label> : null}
        <textarea name={fields === "advance" ? "reason" : "notes"} placeholder={fields === "advance" ? t("pages.technician.reasonAdvance") : t("pages.technician.generalNote")} className="min-h-24 rounded-md border px-3 py-3" />
        <button className="rounded-md bg-mint px-4 py-3 font-semibold text-white">{t("common.actions.submit")}</button>
      </div>
    </form>
  );
}
