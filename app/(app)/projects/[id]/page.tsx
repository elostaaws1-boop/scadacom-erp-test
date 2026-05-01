import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { StatusBadge } from "@/components/status-badge";
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
        <StatCard label="Contract value" value={mad(project.contractValue)} />
        <StatCard label="Allocated budget" value={mad(project.allocatedBudget)} />
        <StatCard label="Approved purchases" value={mad(summary.purchaseCost)} />
        <StatCard label="Allowances" value={mad(summary.allowanceCost)} />
        <StatCard label="Margin" value={`${margin.toFixed(1)}%`} />
      </div>
      <section className="mt-6 rounded-lg border border-black/10 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold">Cost Rule</h2>
        <p className="mt-2 text-sm text-stone-600">Pending and rejected submissions are excluded from project cost. Deployment allowance is automatic and receipt-free. Food, hotel, and personal spending belong inside allowance unless an admin override is recorded.</p>
      </section>
    </>
  );
}
