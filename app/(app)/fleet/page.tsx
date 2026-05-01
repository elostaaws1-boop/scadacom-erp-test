import { AlertTriangle, MapPin, Plus, Wrench } from "lucide-react";
import { createVehicle, updateVehicle } from "@/app/actions";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { mad } from "@/lib/money";
import { prisma } from "@/lib/prisma";

const alertWindowDays = 30;

export default async function FleetPage() {
  const [vehicles, employees, projects] = await Promise.all([
    prisma.vehicle.findMany({
      include: { driver: true, project: true, missions: { include: { project: true }, orderBy: { startDate: "desc" }, take: 3 } },
      orderBy: { plate: "asc" }
    }),
    prisma.employee.findMany({ where: { active: true }, orderBy: { fullName: "asc" } }),
    prisma.project.findMany({ where: { status: { in: ["PLANNED", "ACTIVE", "ON_HOLD"] } }, orderBy: { name: "asc" } })
  ]);
  const today = new Date();
  const maintenanceAlerts = vehicles.flatMap((vehicle) => dueAlerts(vehicle, today));
  const assignedVehicles = vehicles.filter((vehicle) => vehicle.driverId || vehicle.projectId || vehicle.missions.length > 0).length;
  const totalFuel = vehicles.reduce((sum, vehicle) => sum + Number(vehicle.fuelUsage), 0);
  const totalMileage = vehicles.reduce((sum, vehicle) => sum + vehicle.mileage, 0);

  return (
    <>
      <PageHeader title="Fleet Operations" description="Vehicle registry, assignment, mileage, fuel tracking, location, GPS-ready fields, and maintenance alerts." />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Vehicles" value={vehicles.length} detail={`${assignedVehicles} currently assigned`} />
        <StatCard label="Total mileage" value={`${totalMileage.toLocaleString("fr-MA")} km`} />
        <StatCard label="Fuel usage tracked" value={mad(totalFuel)} detail="Operational fuel amount" />
        <StatCard label="Maintenance alerts" value={maintenanceAlerts.length} detail={`Due within ${alertWindowDays} days or overdue`} />
      </div>

      <section className="mt-6 rounded-lg border border-black/10 bg-white p-5 shadow-sm">
        <div className="flex items-center gap-2">
          <Plus size={18} />
          <h2 className="text-lg font-semibold">Add Vehicle</h2>
        </div>
        <VehicleForm action={createVehicle} employees={employees} projects={projects} submitLabel="Add vehicle" />
      </section>

      {maintenanceAlerts.length > 0 ? (
        <section className="mt-6 rounded-lg border border-amber-200 bg-amber-50 p-5">
          <div className="flex items-center gap-2 text-amber-900">
            <AlertTriangle size={18} />
            <h2 className="text-lg font-semibold">Maintenance Alerts</h2>
          </div>
          <div className="mt-3 grid gap-2">
            {maintenanceAlerts.map((alert) => (
              <p className="rounded-md bg-white px-3 py-2 text-sm text-amber-900" key={`${alert.plate}-${alert.label}`}>
                <strong>{alert.plate}</strong> · {alert.label}: {alert.date.toLocaleDateString("fr-MA")} ({alert.status})
              </p>
            ))}
          </div>
        </section>
      ) : null}

      <div className="mt-6 grid gap-4 xl:grid-cols-2">
        {vehicles.map((vehicle) => (
          <section className="rounded-lg border border-black/10 bg-white p-5 shadow-sm" key={vehicle.id}>
            <div className="flex flex-col justify-between gap-3 md:flex-row">
              <div>
                <h2 className="text-lg font-semibold">{vehicle.plate} · {vehicle.model}</h2>
                <p className="mt-1 text-sm text-stone-500">
                  {vehicle.driver?.fullName || "No driver"} · {vehicle.project?.name || "No project"}
                </p>
              </div>
              <div className="flex gap-2">
                {vehicle.googleMapsLink ? (
                  <a className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-black/10" href={vehicle.googleMapsLink} title="Open map">
                    <MapPin size={17} />
                  </a>
                ) : null}
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-md bg-field" title="Maintenance">
                  <Wrench size={17} />
                </span>
              </div>
            </div>

            <div className="mt-4 grid gap-3 text-sm md:grid-cols-3">
              <p><span className="block text-stone-500">Mileage</span>{vehicle.mileage.toLocaleString("fr-MA")} km</p>
              <p><span className="block text-stone-500">Fuel</span>{mad(vehicle.fuelUsage)}</p>
              <p><span className="block text-stone-500">Location</span>{vehicle.locationType}</p>
            </div>

            <div className="mt-4 rounded-md bg-field p-3 text-sm">
              <p className="font-semibold">Recent mission assignment</p>
              <p className="mt-1 text-stone-600">
                {vehicle.missions.length > 0
                  ? vehicle.missions.map((mission) => `${mission.title} (${mission.project.name})`).join(", ")
                  : "No mission assignment yet"}
              </p>
            </div>

            <details className="mt-4">
              <summary className="cursor-pointer text-sm font-semibold text-mint">Update vehicle operations</summary>
              <VehicleForm action={updateVehicle} employees={employees} projects={projects} vehicle={vehicle} submitLabel="Save vehicle" />
            </details>
          </section>
        ))}
      </div>
    </>
  );
}

function VehicleForm({
  action,
  employees,
  projects,
  vehicle,
  submitLabel
}: {
  action: (formData: FormData) => Promise<void>;
  employees: { id: string; fullName: string }[];
  projects: { id: string; name: string }[];
  vehicle?: {
    id: string;
    plate: string;
    model: string;
    driverId: string | null;
    projectId: string | null;
    mileage: number;
    fuelUsage: unknown;
    googleMapsLink: string | null;
    latitude: unknown;
    longitude: unknown;
    locationType: string;
    oilChangeDue: Date | null;
    insuranceDue: Date | null;
    inspectionDue: Date | null;
  };
  submitLabel: string;
}) {
  return (
    <form action={action} className="mt-4 grid gap-3 md:grid-cols-3">
      {vehicle ? <input type="hidden" name="id" value={vehicle.id} /> : null}
      <input name="plate" required placeholder="Plate" defaultValue={vehicle?.plate} className="rounded-md border px-3 py-3" />
      <input name="model" required placeholder="Model" defaultValue={vehicle?.model} className="rounded-md border px-3 py-3" />
      <select name="driverId" defaultValue={vehicle?.driverId ?? ""} className="rounded-md border px-3 py-3">
        <option value="">No driver</option>
        {employees.map((employee) => <option value={employee.id} key={employee.id}>{employee.fullName}</option>)}
      </select>
      <select name="projectId" defaultValue={vehicle?.projectId ?? ""} className="rounded-md border px-3 py-3">
        <option value="">No project</option>
        {projects.map((project) => <option value={project.id} key={project.id}>{project.name}</option>)}
      </select>
      <input name="mileage" type="number" min="0" defaultValue={vehicle?.mileage ?? 0} placeholder="Mileage km" className="rounded-md border px-3 py-3" />
      <input name="fuelUsage" type="number" step="0.01" min="0" defaultValue={String(vehicle?.fuelUsage ?? 0)} placeholder="Fuel amount MAD" className="rounded-md border px-3 py-3" />
      <input name="googleMapsLink" defaultValue={vehicle?.googleMapsLink ?? ""} placeholder="Google Maps link" className="rounded-md border px-3 py-3" />
      <select name="locationType" defaultValue={vehicle?.locationType ?? "MANUAL"} className="rounded-md border px-3 py-3">
        <option>MANUAL</option>
        <option>GOOGLE_MAPS</option>
        <option>GPS</option>
      </select>
      <div className="grid grid-cols-2 gap-2">
        <input name="latitude" defaultValue={String(vehicle?.latitude ?? "")} placeholder="Latitude" className="rounded-md border px-3 py-3" />
        <input name="longitude" defaultValue={String(vehicle?.longitude ?? "")} placeholder="Longitude" className="rounded-md border px-3 py-3" />
      </div>
      <label className="text-sm font-medium">Oil change due<input name="oilChangeDue" type="date" defaultValue={dateValue(vehicle?.oilChangeDue)} className="mt-1 w-full rounded-md border px-3 py-3" /></label>
      <label className="text-sm font-medium">Insurance due<input name="insuranceDue" type="date" defaultValue={dateValue(vehicle?.insuranceDue)} className="mt-1 w-full rounded-md border px-3 py-3" /></label>
      <label className="text-sm font-medium">Inspection due<input name="inspectionDue" type="date" defaultValue={dateValue(vehicle?.inspectionDue)} className="mt-1 w-full rounded-md border px-3 py-3" /></label>
      <button className="rounded-md bg-ink px-4 py-3 font-semibold text-white md:col-span-3">{submitLabel}</button>
    </form>
  );
}

function dateValue(date?: Date | null) {
  return date ? date.toISOString().slice(0, 10) : "";
}

function dueAlerts(vehicle: { plate: string; oilChangeDue: Date | null; insuranceDue: Date | null; inspectionDue: Date | null }, today: Date) {
  return [
    { label: "Oil change", date: vehicle.oilChangeDue },
    { label: "Insurance", date: vehicle.insuranceDue },
    { label: "Inspection", date: vehicle.inspectionDue }
  ].flatMap((item) => {
    if (!item.date) return [];
    const days = Math.ceil((item.date.getTime() - today.getTime()) / 86_400_000);
    if (days > alertWindowDays) return [];
    return [{ plate: vehicle.plate, label: item.label, date: item.date, status: days < 0 ? "overdue" : `${days} days left` }];
  });
}
