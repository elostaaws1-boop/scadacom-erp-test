import { Plus } from "lucide-react";
import { auth } from "@/auth";
import { PageHeader } from "@/components/page-header";
import { DataTable } from "@/components/data-table";
import { StatusBadge } from "@/components/status-badge";
import { mad } from "@/lib/money";
import { projectScopeWhere } from "@/lib/access";
import { prisma } from "@/lib/prisma";

export default async function ProjectsPage() {
  const session = await auth();
  const projects = await prisma.project.findMany({ where: await projectScopeWhere(session!.user), orderBy: { createdAt: "desc" } });
  return (
    <>
      <PageHeader
        title="Projects"
        description="Contract value, allocated budget, committed cost, actual cost, and remaining budget are tracked here."
        action={<a className="inline-flex items-center gap-2 rounded-md bg-ink px-4 py-2 text-sm font-semibold text-white" href="/projects/new"><Plus size={16} /> New project</a>}
      />
      <DataTable>
        <table className="w-full min-w-[860px] text-left text-sm">
          <thead className="bg-field text-xs uppercase text-stone-500">
            <tr><th className="px-4 py-3">Project</th><th>Client</th><th>Technology</th><th>Budget</th><th>Actual</th><th>Remaining</th><th>Status</th></tr>
          </thead>
          <tbody>
            {projects.map((project) => (
              <tr className="border-t border-black/10" key={project.id}>
                <td className="px-4 py-3"><a className="font-semibold text-mint" href={`/projects/${project.id}`}>{project.name}</a><div className="text-xs text-stone-500">{project.region} · {project.siteId}</div></td>
                <td>{project.client.replaceAll("_", " ")}</td>
                <td>{project.technology.replaceAll("_", " ")}</td>
                <td>{mad(project.allocatedBudget)}</td>
                <td>{mad(project.actualCost)}</td>
                <td>{mad(Number(project.allocatedBudget) - Number(project.actualCost))}</td>
                <td><StatusBadge status={project.status} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </DataTable>
    </>
  );
}
