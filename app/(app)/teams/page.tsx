import { createTeam } from "@/app/actions";
import { PageHeader } from "@/components/page-header";
import { prisma } from "@/lib/prisma";
import { getTranslator } from "@/lib/i18n-server";

export default async function TeamsPage() {
  const { t } = await getTranslator();
  const [teams, employees] = await Promise.all([
    prisma.team.findMany({ include: { members: { include: { employee: true } } }, orderBy: { name: "asc" } }),
    prisma.employee.findMany({ where: { active: true }, orderBy: { fullName: "asc" } })
  ]);
  return (
    <>
      <PageHeader titleKey="pages.teams.title" descriptionKey="pages.teams.description" />
      <form action={createTeam} className="mb-6 rounded-lg border border-black/10 bg-white p-5 shadow-sm">
        <div className="grid gap-3 md:grid-cols-2">
          <input name="name" placeholder={t("pages.teams.teamName")} required className="rounded-md border px-3 py-3" />
          <select name="leaderId" className="rounded-md border px-3 py-3"><option value="">{t("common.fields.leader")}</option>{employees.map((e) => <option value={e.id} key={e.id}>{e.fullName}</option>)}</select>
        </div>
        <div className="mt-4 grid gap-2 md:grid-cols-3">
          {employees.map((employee) => (
            <label className="flex items-center gap-2 rounded-md border border-black/10 px-3 py-2 text-sm" key={employee.id}>
              <input type="checkbox" name="memberIds" value={employee.id} /> {employee.fullName}
            </label>
          ))}
        </div>
        <button className="mt-4 rounded-md bg-ink px-4 py-3 font-semibold text-white">{t("pages.teams.create")}</button>
      </form>
      <div className="grid gap-4 lg:grid-cols-2">
        {teams.map((team) => <section className="rounded-lg border border-black/10 bg-white p-5 shadow-sm" key={team.id}><h2 className="font-semibold">{team.name}</h2><p className="mt-2 text-sm text-stone-600">{team.members.map((m) => m.employee.fullName).join(", ") || t("common.empty.noMembers")}</p></section>)}
      </div>
    </>
  );
}
