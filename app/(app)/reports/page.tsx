import { Download } from "lucide-react";
import { auth } from "@/auth";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { projectScopeWhere } from "@/lib/access";
import { mad } from "@/lib/money";
import { prisma } from "@/lib/prisma";
import { financeRoles } from "@/lib/rbac";

export default async function ReportsPage() {
  const session = await auth();
  const canSeeGlobalFinance = financeRoles.includes(session!.user.role);
  const [projects, suppliers, taxes] = await Promise.all([
    prisma.project.findMany({ where: await projectScopeWhere(session!.user) }),
    canSeeGlobalFinance ? prisma.supplierInvoice.findMany() : Promise.resolve([]),
    canSeeGlobalFinance ? prisma.taxObligation.findMany() : Promise.resolve([])
  ]);
  const profit = projects.reduce((sum, p) => sum + Number(p.contractValue) - Number(p.actualCost), 0);
  const supplierDebt = suppliers.reduce((sum, i) => sum + Number(i.amount) - Number(i.paidAmount), 0);
  const taxDebt = taxes.reduce((sum, t) => sum + Number(t.amountDue) - Number(t.paid), 0);
  return (
    <>
      <PageHeader titleKey="pages.reports.title" descriptionKey="pages.reports.description" action={<div className="flex gap-2"><a className="inline-flex items-center gap-2 rounded-md border border-black/10 bg-white px-4 py-2 text-sm font-semibold" href="/api/export?format=xlsx"><Download size={16} /> Excel</a><a className="inline-flex items-center gap-2 rounded-md bg-ink px-4 py-2 text-sm font-semibold text-white" href="/api/export?format=pdf"><Download size={16} /> PDF</a></div>} />
      <div className="grid gap-4 md:grid-cols-3">
        <StatCard labelKey="pages.reports.portfolioProfit" value={mad(profit)} />
        <StatCard labelKey="pages.reports.supplierDebt" value={mad(supplierDebt)} />
        <StatCard labelKey="pages.reports.taxRemaining" value={mad(taxDebt)} />
      </div>
    </>
  );
}
