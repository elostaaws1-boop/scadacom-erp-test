import { ApprovalForm } from "@/components/approval-form";
import { auth } from "@/auth";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { mad } from "@/lib/money";
import { projectIdsForUser } from "@/lib/access";
import { prisma } from "@/lib/prisma";

export default async function ExpensesPage() {
  const session = await auth();
  const projectIds = await projectIdsForUser(session!.user);
  const expenses = await prisma.expense.findMany({ where: projectIds ? { projectId: { in: projectIds } } : {}, include: { project: true, mission: true, receipts: true }, orderBy: { createdAt: "desc" } });
  return (
    <>
      <PageHeader title="Expenses" description="Pending expenses never affect project cost. Food, hotel, and personal expenses are blocked unless explicitly overridden." />
      <div className="grid gap-4">
        {expenses.map((item) => {
          const receiptTotal = item.receipts.reduce((sum, receipt) => sum + Number(receipt.costMad), 0);
          return (
            <section className="rounded-lg border border-black/10 bg-white p-5 shadow-sm" key={item.id}>
              <div className="flex flex-col justify-between gap-3 md:flex-row">
                <div><h2 className="font-semibold">{item.category} · {mad(item.amount)}</h2><p className="text-sm text-stone-500">{item.project.name}{item.adminOverride ? " · Admin override" : ""} · {item.receipts.length} receipt{item.receipts.length === 1 ? "" : "s"} · receipt total {mad(receiptTotal)}</p></div>
                <StatusBadge status={item.status} />
              </div>
              {item.status === "PENDING" ? <div className="mt-4"><ApprovalForm entity="expense" id={item.id} amount={Number(item.amount)} /></div> : null}
            </section>
          );
        })}
      </div>
    </>
  );
}
