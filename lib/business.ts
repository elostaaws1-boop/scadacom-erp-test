import { ApprovalStatus, Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { canOverride } from "@/lib/rbac";

export function allowanceRateToMad(rate: string) {
  if (rate === "MAD_152") return 152;
  if (rate === "MAD_175") return 175;
  return 160;
}

export function missionDays(startDate: Date, endDate: Date) {
  const ms = endDate.getTime() - startDate.getTime();
  return Math.max(1, Math.floor(ms / 86_400_000) + 1);
}

export function isForbiddenFieldExpense(category: string, adminOverride: boolean) {
  return ["food", "hotel", "personal"].includes(category.toLowerCase()) && !adminOverride;
}

export async function projectCostSummary(projectId: string) {
  const [project, purchases, expenses, allowances] = await Promise.all([
    prisma.project.findUniqueOrThrow({ where: { id: projectId } }),
    prisma.purchase.findMany({ where: { projectId, status: { in: ["APPROVED", "PARTIALLY_APPROVED"] } } }),
    prisma.expense.findMany({ where: { projectId, status: { in: ["APPROVED", "PARTIALLY_APPROVED"] } } }),
    prisma.deploymentAllowance.findMany({ where: { mission: { projectId }, approved: true } })
  ]);

  const purchaseCost = purchases.reduce((sum, item) => sum + Number(item.approvedAmount ?? item.amount), 0);
  const expenseCost = expenses.reduce((sum, item) => sum + Number(item.approvedAmount ?? item.amount), 0);
  const allowanceCost = allowances.reduce((sum, item) => sum + Number(item.totalMad), 0);
  const actualCost = purchaseCost + expenseCost + allowanceCost;
  const remainingBudget = Number(project.allocatedBudget) - actualCost;

  return { project, purchaseCost, expenseCost, allowanceCost, actualCost, remainingBudget };
}

export async function hasCash(amount: number) {
  const accounts = await prisma.cashAccount.findMany();
  return accounts.reduce((sum, account) => sum + Number(account.balance), 0) >= amount;
}

export async function canSpendProject(projectId: string, amount: number, role: Role) {
  const { remainingBudget } = await projectCostSummary(projectId);
  const cashOk = await hasCash(amount);
  if (remainingBudget >= amount && cashOk) return { ok: true, needsOverride: false };
  return { ok: canOverride(role), needsOverride: true, remainingBudget, cashOk };
}

export async function recalculateProjectCost(projectId: string) {
  const summary = await projectCostSummary(projectId);
  await prisma.project.update({
    where: { id: projectId },
    data: {
      actualCost: summary.actualCost,
      committedBudget: summary.actualCost
    }
  });
  return summary;
}

export function countedStatus(status: ApprovalStatus) {
  return status === "APPROVED" || status === "PARTIALLY_APPROVED";
}
