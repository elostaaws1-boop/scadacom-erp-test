import type { Role } from "@prisma/client";
import { projectIdsForUser } from "@/lib/access";
import { isBossIdentity } from "@/lib/rbac";

export type AuditUser = { id: string; role: Role; email?: string | null };

export function canViewAuditHistory(user: AuditUser) {
  return isBossIdentity(user.role, user.email) || ["GENERAL_MANAGER", "PROJECT_MANAGER", "FINANCIAL_DEPARTMENT", "ACCOUNTANT", "SUPER_ADMIN", "ADMIN"].includes(user.role);
}

export function canHardDelete(user: AuditUser) {
  return isBossIdentity(user.role, user.email);
}

export function canSoftDelete(user: AuditUser) {
  return isBossIdentity(user.role, user.email) || ["GENERAL_MANAGER", "SUPER_ADMIN", "ADMIN"].includes(user.role);
}

export async function auditVisibilityFilter(user: AuditUser) {
  if (isBossIdentity(user.role, user.email) || user.role === "SUPER_ADMIN" || user.role === "ADMIN") return {};
  if (user.role === "GENERAL_MANAGER") return { module: { notIn: ["BossAiAssistant"] } };
  if (["FINANCIAL_DEPARTMENT", "ACCOUNTANT"].includes(user.role)) {
    return { OR: [{ financialAction: true }, { module: { in: ["Purchase", "Expense", "AdvanceRequest", "CashMovement", "Supplier", "SupplierInvoice", "TaxObligation"] } }] };
  }
  if (user.role === "PROJECT_MANAGER") {
    const projectIds = await projectIdsForUser(user);
    return { OR: [{ projectId: { in: projectIds ?? [] } }, { recordId: { in: projectIds ?? [] } }] };
  }
  return { id: "__none__" };
}
