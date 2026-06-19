"use client";

import { useActionState, useMemo, useState } from "react";
import { createTeam, type TeamActionState } from "@/app/actions";
import { T, useTranslation } from "@/components/translated-text";

type Option = {
  id: string;
  label: string;
  meta?: string;
};

type VehicleOption = Option & {
  assignedTeam?: string | null;
};

const initialState: TeamActionState = { ok: false };

export function TeamForm({
  leaders,
  technicians,
  drivers,
  vehicles,
  projects,
  canOverrideVehicle
}: {
  leaders: Option[];
  technicians: Option[];
  drivers: Option[];
  vehicles: VehicleOption[];
  projects: Option[];
  canOverrideVehicle: boolean;
}) {
  const { t } = useTranslation();
  const [state, formAction, pending] = useActionState(createTeam, initialState);
  const [leaderId, setLeaderId] = useState("");
  const [driverId, setDriverId] = useState("");
  const [vehicleId, setVehicleId] = useState("");
  const [search, setSearch] = useState("");
  const [selectedTechnicians, setSelectedTechnicians] = useState<string[]>([]);

  const filteredTechnicians = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return technicians;
    return technicians.filter((technician) => `${technician.label} ${technician.meta ?? ""}`.toLowerCase().includes(needle));
  }, [search, technicians]);

  const selectedVehicle = vehicles.find((vehicle) => vehicle.id === vehicleId);
  const leaderTechnicianConflict = leaderId ? selectedTechnicians.includes(leaderId) : false;
  const duplicateEmployeeConflict = driverId ? [leaderId, ...selectedTechnicians].filter(Boolean).includes(driverId) : false;

  function toggleTechnician(id: string) {
    setSelectedTechnicians((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
  }

  const clientError = leaderTechnicianConflict
    ? "pages.teams.validation.leaderTechnicianConflict"
    : duplicateEmployeeConflict
      ? "pages.teams.validation.duplicateEmployee"
      : "";

  return (
    <form action={formAction} className="mb-6 rounded-lg border border-black/10 bg-white p-4 shadow-sm md:p-5">
      <div className="mb-4 flex flex-col gap-2">
        <h2 className="text-lg font-semibold text-ink"><T k="pages.teams.formTitle" /></h2>
        <p className="text-sm text-stone-600"><T k="pages.teams.formDescription" /></p>
      </div>

      {(state.messageKey || clientError) ? (
        <div className={`mb-4 rounded-md border px-3 py-2 text-sm ${state.ok ? "border-emerald-200 bg-emerald-50 text-emerald-900" : "border-red-200 bg-red-50 text-red-900"}`}>
          <T k={clientError || state.messageKey || "pages.teams.validation.failed"} />
        </div>
      ) : null}

      <div className="grid gap-3 lg:grid-cols-2">
        <label className="grid gap-1 text-sm font-medium text-stone-700">
          <span><T k="pages.teams.teamName" /></span>
          <input name="name" required className="rounded-md border px-3 py-3" />
        </label>

        <label className="grid gap-1 text-sm font-medium text-stone-700">
          <span><T k="pages.teams.teamLeader" /></span>
          <select name="leaderId" required value={leaderId} onChange={(event) => setLeaderId(event.target.value)} className="rounded-md border px-3 py-3">
            <option value="">{t("pages.teams.selectLeader")}</option>
            {leaders.map((leader) => (
              <option value={leader.id} key={leader.id}>{leader.label}</option>
            ))}
          </select>
        </label>

        <label className="grid gap-1 text-sm font-medium text-stone-700">
          <span><T k="pages.teams.driver" /></span>
          <select name="driverId" value={driverId} onChange={(event) => setDriverId(event.target.value)} className="rounded-md border px-3 py-3">
            <option value="">{t("common.empty.noDriver")}</option>
            {drivers.map((driver) => (
              <option value={driver.id} key={driver.id}>{driver.label}{driver.meta ? ` - ${driver.meta}` : ""}</option>
            ))}
          </select>
        </label>

        <label className="grid gap-1 text-sm font-medium text-stone-700">
          <span><T k="pages.teams.assignedVehicle" /></span>
          <select name="vehicleId" value={vehicleId} onChange={(event) => setVehicleId(event.target.value)} className="rounded-md border px-3 py-3">
            <option value="">{t("pages.teams.noVehicleAssigned")}</option>
            {vehicles.map((vehicle) => (
              <option value={vehicle.id} key={vehicle.id}>
                {vehicle.label}{vehicle.assignedTeam ? ` - ${t("pages.teams.assignedTo", { team: vehicle.assignedTeam })}` : ""}
              </option>
            ))}
          </select>
        </label>

        <label className="grid gap-1 text-sm font-medium text-stone-700">
          <span><T k="pages.teams.assignedProject" /></span>
          <select name="projectId" className="rounded-md border px-3 py-3">
            <option value="">{t("common.empty.noProject")}</option>
            {projects.map((project) => (
              <option value={project.id} key={project.id}>{project.label}{project.meta ? ` - ${project.meta}` : ""}</option>
            ))}
          </select>
        </label>

        <label className="grid gap-1 text-sm font-medium text-stone-700">
          <span><T k="pages.teams.teamStatus" /></span>
          <select name="status" className="rounded-md border px-3 py-3">
            <option value="AVAILABLE">{t("pages.teams.status.AVAILABLE")}</option>
            <option value="ASSIGNED">{t("pages.teams.status.ASSIGNED")}</option>
            <option value="ON_MISSION">{t("pages.teams.status.ON_MISSION")}</option>
            <option value="INACTIVE">{t("pages.teams.status.INACTIVE")}</option>
          </select>
        </label>
      </div>

      <section className="mt-4 rounded-lg border border-black/10 p-3">
        <div className="flex flex-col justify-between gap-3 md:flex-row md:items-end">
          <div>
            <h3 className="font-semibold text-ink"><T k="pages.teams.technicians" /></h3>
            <p className="text-sm text-stone-600"><T k="pages.teams.technicianHelp" values={{ count: selectedTechnicians.length }} /></p>
          </div>
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={t("pages.teams.searchTechnicians")}
            className="w-full rounded-md border px-3 py-2 text-sm md:w-72"
          />
        </div>
        <div className="mt-3 grid max-h-72 gap-2 overflow-y-auto pr-1 md:grid-cols-2 xl:grid-cols-3">
          {filteredTechnicians.length === 0 ? (
            <p className="rounded-md bg-stone-50 px-3 py-3 text-sm text-stone-600"><T k="pages.teams.noTechnicians" /></p>
          ) : filteredTechnicians.map((technician) => (
            <label className="flex items-start gap-2 rounded-md border border-black/10 px-3 py-2 text-sm" key={technician.id}>
              <input
                type="checkbox"
                name="technicianIds"
                value={technician.id}
                checked={selectedTechnicians.includes(technician.id)}
                onChange={() => toggleTechnician(technician.id)}
                className="mt-1"
              />
              <span>
                <span className="block font-medium text-ink">{technician.label}</span>
                {technician.meta ? <span className="text-xs text-stone-500">{technician.meta}</span> : null}
              </span>
            </label>
          ))}
        </div>
      </section>

      <label className="mt-4 grid gap-1 text-sm font-medium text-stone-700">
        <span><T k="common.fields.notes" /></span>
        <textarea name="notes" rows={3} className="rounded-md border px-3 py-3" />
      </label>

      <div className="mt-4 grid gap-2 text-sm text-stone-700 md:grid-cols-2">
        <label className="flex items-center gap-2">
          <input type="checkbox" name="allowLeaderAsTechnician" />
          <span><T k="pages.teams.allowLeaderAsTechnician" /></span>
        </label>
        {canOverrideVehicle && selectedVehicle?.assignedTeam ? (
          <label className="flex items-center gap-2">
            <input type="checkbox" name="overrideVehicleConflict" />
            <span><T k="pages.teams.overrideVehicleConflict" /></span>
          </label>
        ) : null}
      </div>

      <button disabled={pending || Boolean(clientError)} className="mt-4 w-full rounded-md bg-ink px-4 py-3 font-semibold text-white disabled:cursor-not-allowed disabled:bg-stone-400 md:w-auto">
        {pending ? <T k="common.actions.creating" /> : <T k="pages.teams.create" />}
      </button>
    </form>
  );
}
