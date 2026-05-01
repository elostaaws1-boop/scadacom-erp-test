import { createMission } from "@/app/actions";
import { auth } from "@/auth";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { projectIdsForUser, projectScopeWhere } from "@/lib/access";
import { prisma } from "@/lib/prisma";

export default async function MissionsPage() {
  const session = await auth();
  const projectIds = await projectIdsForUser(session!.user);
  const [missions, projects, teams] = await Promise.all([
    prisma.mission.findMany({ where: projectIds ? { projectId: { in: projectIds } } : {}, include: { project: true, team: true, technicians: true }, orderBy: { createdAt: "desc" } }),
    prisma.project.findMany({ where: await projectScopeWhere(session!.user), orderBy: { name: "asc" } }),
    prisma.team.findMany({ orderBy: { name: "asc" } })
  ]);
  return (
    <>
      <PageHeader title="Missions" description="Missions lock the team list to prevent ghost workers. End date can stay empty until the mission is completed." />
      <form action={createMission} className="mb-6 grid gap-3 rounded-lg border border-black/10 bg-white p-4 shadow-sm md:grid-cols-3">
        <input name="title" placeholder="Mission title" required className="rounded-md border px-3 py-3" />
        <select name="projectId" required className="rounded-md border px-3 py-3">{projects.map((p) => <option value={p.id} key={p.id}>{p.name}</option>)}</select>
        <select name="teamId" required className="rounded-md border px-3 py-3">{teams.map((t) => <option value={t.id} key={t.id}>{t.name}</option>)}</select>
        <input name="location" placeholder="Location" required className="rounded-md border px-3 py-3" />
        <input name="startDate" type="date" required className="rounded-md border px-3 py-3" />
        <input name="endDate" type="date" className="rounded-md border px-3 py-3" title="Optional until completion" />
        <button className="rounded-md bg-ink px-4 py-3 font-semibold text-white md:col-span-3">Create locked mission</button>
      </form>
      <div className="grid gap-4 lg:grid-cols-2">
        {missions.map((mission) => (
          <section className="rounded-lg border border-black/10 bg-white p-5 shadow-sm" key={mission.id}>
            <div className="flex justify-between gap-3">
              <div><h2 className="font-semibold">{mission.title}</h2><p className="text-sm text-stone-500">{mission.project.name} · {mission.location}</p></div>
              <StatusBadge status={mission.status} />
            </div>
            <div className="mt-4 grid grid-cols-3 gap-3 text-sm">
              <p><span className="block text-stone-500">Days</span>{mission.endDate ? mission.days : `${mission.days} provisional`}</p>
              <p><span className="block text-stone-500">Team</span>{mission.team.name}</p>
              <p><span className="block text-stone-500">Workers</span>{mission.technicians.length}</p>
            </div>
          </section>
        ))}
      </div>
    </>
  );
}
