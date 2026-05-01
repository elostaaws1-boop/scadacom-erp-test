import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { StatusBadge } from "@/components/status-badge";
import { T } from "@/components/translated-text";
import { projectCostSummary } from "@/lib/business";
import { canAccessProject } from "@/lib/access";
import { mad } from "@/lib/money";

export default async function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user || !(await canAccessProject(session.user, id))) notFound();
  const summary = await projectCostSummary(id).catch(() => null);
  if (!summary) notFound();
  const { project } = summary;
  const margin = Number(project.contractValue) ? ((Number(project.contractValue) - summary.actualCost) / Number(project.contractValue)) * 100 : 0;
  return (
    <>
      <PageHeader title={project.name} description={`${project.region} · ${project.siteId} · ${project.workType.replaceAll("_", " ")}`} action={<StatusBadge status={project.status} />} />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <StatCard labelKey="pages.projects.contractValue" value={mad(project.contractValue)} />
        <StatCard labelKey="pages.projects.allocatedBudget" value={mad(project.allocatedBudget)} />
        <StatCard labelKey="pages.approvals.purchaseTitle" value={mad(summary.purchaseCost)} />
        <StatCard labelKey="pages.approvals.allowanceTitle" value={mad(summary.allowanceCost)} />
        <StatCard labelKey="pages.bossRoom.margin" value={`${margin.toFixed(1)}%`} />
      </div>
      <section className="mt-6 rounded-lg border border-black/10 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold"><T k="pages.projects.costRule" /></h2>
        <p className="mt-2 text-sm text-stone-600"><T k="pages.projects.costRuleDescription" /></p>
      </section>
    </>
  );
}
