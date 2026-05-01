import { PageHeader } from "@/components/page-header";
import { auth } from "@/auth";
import { projectIdsForUser } from "@/lib/access";
import { mad } from "@/lib/money";
import { prisma } from "@/lib/prisma";

export default async function AllowancesPage() {
  const session = await auth();
  const projectIds = await projectIdsForUser(session!.user);
  const allowances = await prisma.deploymentAllowance.findMany({ where: projectIds ? { mission: { projectId: { in: projectIds } } } : {}, include: { mission: { include: { project: true } } }, orderBy: { createdAt: "desc" } });
  return (
    <>
      <PageHeader title="Deployment Allowances" description="Auto-calculated as mission days multiplied by each technician's 152, 160, or 175 MAD rate. No receipt required." />
      <div className="grid gap-3">
        {allowances.map((item) => <div className="grid gap-2 rounded-lg border border-black/10 bg-white p-4 text-sm shadow-sm md:grid-cols-5" key={item.id}><strong>{item.mission.title}</strong><span>{item.mission.project.name}</span><span>{item.days} days</span><span>{mad(item.rateMad)} / day</span><span>{mad(item.totalMad)}</span></div>)}
      </div>
    </>
  );
}
