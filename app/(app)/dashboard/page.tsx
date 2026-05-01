import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { projectIdsForUser, projectScopeWhere } from "@/lib/access";
import { mad } from "@/lib/money";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { StatusBadge } from "@/components/status-badge";
import { T } from "@/components/translated-text";

export default async function DashboardPage() {
  const session = await auth();
  const scopedProjectWhere = await projectScopeWhere(session!.user);
  const projectIds = await projectIdsForUser(session!.user);
  const [projects, pendingPurchases, pendingExpenses, pendingAdvances, cashAccounts, taxes, approvedPurchases] = await Promise.all([
    prisma.project.findMany({ where: scopedProjectWhere, orderBy: { createdAt: "desc" }, take: 6 }),
    prisma.purchase.count({ where: { status: "PENDING", ...(projectIds ? { projectId: { in: projectIds } } : {}) } }),
    prisma.expense.count({ where: { status: "PENDING", ...(projectIds ? { projectId: { in: projectIds } } : {}) } }),
    prisma.advanceRequest.count({ where: { status: "PENDING", ...(projectIds ? { projectId: { in: projectIds } } : {}) } }),
    prisma.cashAccount.findMany(),
    prisma.taxObligation.findMany({ orderBy: { dueDate: "asc" }, take: 4 }),
    prisma.purchase.findMany({
      where: { status: { in: ["APPROVED", "PARTIALLY_APPROVED"] }, ...(projectIds ? { projectId: { in: projectIds } } : {}) },
      select: { category: true, amount: true, approvedAmount: true }
    })
  ]);
  const cash = cashAccounts.reduce((sum, account) => sum + Number(account.balance), 0);
  const revenue = projects.reduce((sum, project) => sum + Number(project.contractValue), 0);
  const cost = projects.reduce((sum, project) => sum + Number(project.actualCost), 0);
  const categorySpend = Object.values(
    approvedPurchases.reduce<Record<string, { category: string; total: number; count: number }>>((summary, purchase) => {
      const category = purchase.category || "Uncategorized";
      const current = summary[category] ?? { category, total: 0, count: 0 };
      current.total += Number(purchase.approvedAmount ?? purchase.amount);
      current.count += 1;
      summary[category] = current;
      return summary;
    }, {})
  ).sort((a, b) => b.total - a.total);
  const maxCategorySpend = categorySpend[0]?.total ?? 0;
  const categoryTotal = categorySpend.reduce((sum, item) => sum + item.total, 0);

  return (
    <>
      <PageHeader titleKey="pages.dashboard.title" descriptionKey="pages.dashboard.description" />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard labelKey="pages.dashboard.companyCash" value={mad(cash)} detailKey="pages.dashboard.bankCashCombined" />
        <StatCard labelKey="pages.dashboard.openProjectValue" value={mad(revenue)} />
        <StatCard labelKey="pages.dashboard.approvedCost" value={mad(cost)} detailKey="pages.dashboard.pendingExcluded" />
        <StatCard labelKey="pages.dashboard.pendingApprovals" value={pendingPurchases + pendingExpenses + pendingAdvances} detailKey="pages.dashboard.approvalTypes" />
      </div>
      <section className="mt-6 rounded-lg border border-black/10 bg-white p-5 shadow-sm">
        <div className="flex flex-col justify-between gap-2 md:flex-row md:items-end">
          <div>
          <h2 className="text-lg font-semibold"><T k="pages.dashboard.purchaseCategoryAnalysis" /></h2>
            <p className="mt-1 text-sm text-stone-600"><T k="pages.dashboard.purchaseCategoryDescription" /></p>
          </div>
          <p className="text-sm font-semibold text-stone-600"><T k="pages.dashboard.totalAnalyzed" />: {mad(categoryTotal)}</p>
        </div>
        <div className="mt-4 grid gap-3">
          {categorySpend.length > 0 ? (
            categorySpend.slice(0, 8).map((item) => {
              const width = maxCategorySpend ? Math.max(6, (item.total / maxCategorySpend) * 100) : 0;
              return (
                <div className="rounded-md border border-black/10 p-3" key={item.category}>
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <div>
                      <p className="font-semibold text-ink">{item.category}</p>
                      <p className="text-xs text-stone-500"><T k={item.count === 1 ? "pages.dashboard.approvedPurchaseCount" : "pages.dashboard.approvedPurchasesCount"} values={{ count: item.count }} /></p>
                    </div>
                    <p className="font-semibold">{mad(item.total)}</p>
                  </div>
                  <div className="mt-3 h-2 rounded-full bg-field">
                    <div className="h-2 rounded-full bg-mint" style={{ width: `${width}%` }} />
                  </div>
                </div>
              );
            })
          ) : (
            <p className="rounded-md border border-dashed border-stone-300 p-4 text-sm text-stone-500"><T k="common.empty.noApprovedPurchases" /></p>
          )}
        </div>
      </section>
      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <section className="rounded-lg border border-black/10 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold"><T k="pages.dashboard.recentProjects" /></h2>
          <div className="mt-4 grid gap-3">
            {projects.map((project) => (
              <a className="rounded-md border border-black/10 p-4 hover:bg-field" href={`/projects/${project.id}`} key={project.id}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold">{project.name}</p>
                    <p className="text-sm text-stone-500">{project.region} · {project.siteId}</p>
                  </div>
                  <StatusBadge status={project.status} />
                </div>
                <p className="mt-3 text-sm text-stone-600"><T k="pages.dashboard.budgetLeft" />: {mad(Number(project.allocatedBudget) - Number(project.actualCost))}</p>
              </a>
            ))}
          </div>
        </section>
        <section className="rounded-lg border border-black/10 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold"><T k="pages.dashboard.taxWatch" /></h2>
          <div className="mt-4 grid gap-3">
            {taxes.map((tax) => (
              <div className="rounded-md border border-black/10 p-4" key={tax.id}>
                <div className="flex items-center justify-between">
                  <p className="font-semibold">{tax.type} · {tax.period}</p>
                  <StatusBadge status={tax.status} />
                </div>
                <p className="mt-2 text-sm text-stone-600"><T k="pages.dashboard.remaining" />: {mad(Number(tax.amountDue) - Number(tax.paid))}</p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </>
  );
}
