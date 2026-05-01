"use client";

import { useState, useTransition } from "react";
import { createInvite } from "@/app/actions";
import { roleLabels } from "@/lib/rbac";

const roles = ["GENERAL_MANAGER", "PROJECT_MANAGER", "FINANCIAL_DEPARTMENT", "TEAM_LEADER", "TECHNICIAN", "WAREHOUSE_MANAGER", "FLEET_MANAGER"] as const;

export function InviteForm({ projects }: { projects: { id: string; name: string; siteId: string }[] }) {
  const [link, setLink] = useState("");
  const [role, setRole] = useState<(typeof roles)[number]>("PROJECT_MANAGER");
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  return (
    <section className="mb-6 rounded-lg border border-black/10 bg-white p-4 shadow-sm">
      <form
        className="grid gap-3 md:grid-cols-4"
        onSubmit={(event) => {
          event.preventDefault();
          setError("");
          const formData = new FormData(event.currentTarget);
          startTransition(async () => {
            try {
              setLink(await createInvite(formData));
            } catch (caught) {
              setError(caught instanceof Error ? caught.message : "Could not create invite.");
            }
          });
        }}
      >
        <input name="email" type="email" placeholder="Invite email" required className="rounded-md border px-3 py-3" />
        <select name="role" value={role} onChange={(event) => setRole(event.target.value as typeof role)} className="rounded-md border px-3 py-3">
          {roles.map((item) => <option value={item} key={item}>{roleLabels[item]}</option>)}
        </select>
        <input name="expiresAt" type="datetime-local" required className="rounded-md border px-3 py-3" />
        <button className="rounded-md bg-ink px-4 py-3 font-semibold text-white" disabled={pending}>{pending ? "Creating..." : "Create invite"}</button>
        {role === "PROJECT_MANAGER" ? (
          <div className="rounded-md border border-black/10 p-3 md:col-span-4">
            <p className="mb-2 text-sm font-semibold">Assigned projects for Project Manager</p>
            <div className="grid gap-2 md:grid-cols-3">
              {projects.map((project) => (
                <label className="flex items-center gap-2 text-sm" key={project.id}>
                  <input type="checkbox" name="projectIds" value={project.id} /> {project.name} · {project.siteId}
                </label>
              ))}
            </div>
          </div>
        ) : null}
      </form>
      {error ? <p className="mt-4 rounded-md bg-red-50 p-3 text-sm font-medium text-red-700">{error}</p> : null}
      {link ? <p className="mt-4 rounded-md bg-field p-3 text-sm font-medium">Invite link: <a className="text-mint" href={link}>{link}</a></p> : null}
    </section>
  );
}
