import { assignMissionVehicle, requestAdvance, submitExpense } from "@/app/actions";
import { PageHeader } from "@/components/page-header";
import { ReceiptCameraInput } from "@/components/receipt-camera-input";
import { auth } from "@/auth";
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

export default async function TechnicianPage() {
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
      <PageHeader title="Technician App" description="Limited field access for assigned missions, vehicle assignment, receipt capture, and advance payment demands." />
      {missions.length === 0 ? (
        <section className="rounded-lg border border-dashed border-stone-300 bg-white p-5 text-sm text-stone-600">
          No mission is assigned to this account yet.
        </section>
      ) : null}
      <AssignedMissions missions={missions} />
      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        {isTeamLeader ? <VehicleAssignment missions={missions} vehicles={vehicles} /> : null}
        <FieldForm title="Advance payment demand" action={requestAdvance} projects={projects} missions={missions} fields="advance" />
        <FieldForm title="Capture expense receipts" action={submitExpense} projects={projects} missions={missions} fields="expense" />
      </div>
      <p className="mt-4 text-xs text-stone-500">Signed in as {session?.user.email}. The technician app is limited to assigned missions only.</p>
    </>
  );
}

function AssignedMissions({ missions }: { missions: FieldMission[] }) {
  return (
    <section className="rounded-lg border border-black/10 bg-white p-4 shadow-sm">
      <h2 className="text-lg font-semibold">Assigned Missions</h2>
      <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {missions.map((mission) => (
          <div className="rounded-md border border-black/10 p-3 text-sm" key={mission.id}>
            <p className="font-semibold">{mission.title}</p>
            <p className="mt-1 text-stone-500">{mission.project.name} · {mission.project.siteId}</p>
            <p className="mt-1 text-stone-500">{mission.location} · {mission.days} day{mission.days === 1 ? "" : "s"}</p>
            <p className="mt-2 font-medium text-ink">Vehicle: {mission.vehicle ? `${mission.vehicle.plate} · ${mission.vehicle.model}` : "Not assigned"}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function VehicleAssignment({ missions, vehicles }: { missions: FieldMission[]; vehicles: { id: string; plate: string; model: string }[] }) {
  return (
    <form action={assignMissionVehicle} className="rounded-lg border border-black/10 bg-white p-4 shadow-sm">
      <h2 className="text-lg font-semibold">Assign vehicle</h2>
      <div className="mt-4 grid gap-3">
        <select name="missionId" required className="rounded-md border px-3 py-3">
          {missions.map((mission) => (
            <option value={mission.id} key={mission.id}>{mission.title} · {mission.project.name}</option>
          ))}
        </select>
        <select name="vehicleId" required className="rounded-md border px-3 py-3">
          <option value="">Select vehicle</option>
          {vehicles.map((vehicle) => (
            <option value={vehicle.id} key={vehicle.id}>{vehicle.plate} · {vehicle.model}</option>
          ))}
        </select>
        <button className="rounded-md bg-ink px-4 py-3 font-semibold text-white">Assign vehicle</button>
      </div>
    </form>
  );
}

function FieldForm({
  title,
  action,
  projects,
  missions,
  fields
}: {
  title: string;
  action: (formData: FormData) => Promise<void>;
  projects: { id: string; name: string }[];
  missions: FieldMission[];
  fields: "advance" | "purchase" | "expense";
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
        {fields === "purchase" ? <input name="item" required placeholder="Item or product" className="rounded-md border px-3 py-3" /> : null}
        <input name="category" required placeholder={fields === "advance" ? "Fuel / Peage / Materials / Emergency" : "Category"} className="rounded-md border px-3 py-3" />
        <input name="amount" type="number" step="0.01" required placeholder="Amount MAD" className="rounded-md border px-3 py-3" />
        {fields === "purchase" ? <select name="paymentMethod" className="rounded-md border px-3 py-3"><option>CASH</option><option>BANK</option><option>CARD</option><option>ADVANCE</option></select> : null}
        {fields !== "advance" ? <ReceiptCameraInput name="receiptPhotos" /> : null}
        {fields === "expense" ? <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="adminOverride" /> Admin override for food/hotel/personal</label> : null}
        <textarea name={fields === "advance" ? "reason" : "notes"} placeholder={fields === "advance" ? "Reason for advance" : "General note"} className="min-h-24 rounded-md border px-3 py-3" />
        <button className="rounded-md bg-mint px-4 py-3 font-semibold text-white">Submit</button>
      </div>
    </form>
  );
}
