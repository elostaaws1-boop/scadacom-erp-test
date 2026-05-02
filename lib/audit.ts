import { prisma } from "@/lib/prisma";
import type { AuditSeverity, Role } from "@prisma/client";

export async function audit(input: {
  actorId?: string;
  action: string;
  entity: string;
  entityId?: string;
  recordLabel?: string;
  before?: unknown;
  after?: unknown;
  changeSummary?: string;
  reason?: string;
  ip?: string;
  userAgent?: string;
  severity?: AuditSeverity;
  projectId?: string;
  financialAction?: boolean;
  deletedRecord?: boolean;
}) {
  const actor = input.actorId
    ? await prisma.user.findUnique({ where: { id: input.actorId }, select: { name: true, role: true } }).catch(() => null)
    : null;
  const oldValue = cleanJson(input.before);
  const newValue = cleanJson(input.after);
  await prisma.auditLog.create({
    data: {
      actorId: input.actorId,
      action: input.action,
      entity: input.entity,
      entityId: input.entityId,
      before: oldValue,
      after: newValue,
      ip: input.ip,
      actionType: normalizeAction(input.action),
      module: input.entity,
      recordId: input.entityId,
      recordLabel: input.recordLabel ?? inferLabel(input.after) ?? inferLabel(input.before),
      performedByName: actor?.name,
      performedByRole: actor?.role as Role | undefined,
      oldValue,
      newValue,
      changeSummary: input.changeSummary ?? buildChangeSummary(oldValue, newValue),
      reason: input.reason,
      userAgent: input.userAgent,
      severity: input.severity ?? inferSeverity(input.action, input.entity),
      projectId: input.projectId ?? inferProjectId(input.after) ?? inferProjectId(input.before),
      financialAction: input.financialAction ?? isFinancialEntity(input.entity),
      deletedRecord: input.deletedRecord ?? /delete|void|archive/i.test(input.action)
    }
  });
}

export function normalizeAction(action: string) {
  return action.trim().toUpperCase().replace(/\s+/g, "_");
}

function cleanJson(value: unknown) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function inferLabel(value: unknown) {
  if (!value || typeof value !== "object") return undefined;
  const record = value as Record<string, unknown>;
  return String(record.name ?? record.title ?? record.fullName ?? record.plate ?? record.number ?? record.fileName ?? "").trim() || undefined;
}

function inferProjectId(value: unknown) {
  if (!value || typeof value !== "object") return undefined;
  const projectId = (value as Record<string, unknown>).projectId;
  return typeof projectId === "string" ? projectId : undefined;
}

function inferSeverity(action: string, entity: string): AuditSeverity {
  if (/delete|void|hard|failure|failed/i.test(action)) return "CRITICAL";
  if (/approve|reject|archive|reassign|override|cash|tax|supplier/i.test(`${action} ${entity}`)) return "WARNING";
  return "INFO";
}

function isFinancialEntity(entity: string) {
  return ["Purchase", "Expense", "AdvanceRequest", "CashMovement", "Supplier", "SupplierInvoice", "TaxObligation", "MonthlyPerformanceReport", "BossAiAssistant"].includes(entity);
}

function buildChangeSummary(before: unknown, after: unknown) {
  if (!before && after) return "Record created";
  if (before && !after) return "Record removed or archived";
  if (!before || !after || typeof before !== "object" || typeof after !== "object") return undefined;
  const beforeRecord = before as Record<string, unknown>;
  const afterRecord = after as Record<string, unknown>;
  const changed = Object.keys(afterRecord).filter((key) => JSON.stringify(beforeRecord[key]) !== JSON.stringify(afterRecord[key]));
  return changed.length ? `Changed: ${changed.slice(0, 8).join(", ")}` : "No field changes detected";
}
