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
  const advances = await prisma.advanceRequest.findMany({ where: projectIds ? { projectId: { in: projectIds } } : {}, include: { project: true }, orderBy: { createdAt: "desc" } });
  return (
    <>
      <PageHeader title="Advance Requests" description="Advance requests pass project budget and company cash checks. Super Admin can override blocked cases." />
      <div className="grid gap-4">
        {advances.map((item) => (
          <section className="rounded-lg border border-black/10 bg-white p-5 shadow-sm" key={item.id}>
            <div className="flex flex-col justify-between gap-3 md:flex-row">
              <div><h2 className="font-semibold">{item.category} · {mad(item.amount)}</h2><p className="text-sm text-stone-500">{item.project.name} · {item.reason}</p></div>
              <StatusBadge status={item.status} />
            </div>
            {item.status === "PENDING" ? <div className="mt-4"><ApprovalForm entity="advance" id={item.id} amount={Number(item.amount)} /></div> : null}
          </section>
        ))}
      </div>
    </>
  );
}
