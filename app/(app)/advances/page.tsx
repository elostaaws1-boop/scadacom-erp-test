import { ApprovalForm } from "@/components/approval-form";
import { auth } from "@/auth";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { mad } from "@/lib/money";
import { projectIdsForUser } from "@/lib/access";
import { prisma } from "@/lib/prisma";

export default async function AdvancesPage() {
  const session = await auth();
  const projectIds = await projectIdsForUser(session!.user);
  const advances = await prisma.advanceRequest.findMany({
    where: projectIds ? { projectId: { in: projectIds } } : {},
    orderBy: { createdAt: "desc" }
  });
  const projects = await prisma.project.findMany({
    where: { id: { in: Array.from(new Set(advances.map((item) => item.projectId))) } },
    select: { id: true, name: true }
  });
  const projectNames = new Map(projects.map((project) => [project.id, project.name]));

  return (
    <>
      <PageHeader titleKey="pages.approvals.advanceTitle" descriptionKey="pages.approvals.advanceDescription" />
      <div className="grid gap-4">
        {advances.map((item) => (
          <section className="rounded-lg border border-black/10 bg-white p-5 shadow-sm" key={item.id}>
            <div className="flex flex-col justify-between gap-3 md:flex-row">
              <div>
                <h2 className="font-semibold">{item.category} / {mad(item.amount)}</h2>
                <p className="text-sm text-stone-500">{projectNames.get(item.projectId) ?? "Missing project"} / {item.reason}</p>
              </div>
              <StatusBadge status={item.status} />
            </div>
            {item.status === "PENDING" ? <div className="mt-4"><ApprovalForm entity="advance" id={item.id} amount={Number(item.amount)} /></div> : null}
          </section>
        ))}
      </div>
    </>
  );
}
