import { ApprovalStatus, NotificationSeverity, Role } from "@prisma/client";
import { projectIdsForUser } from "@/lib/access";
import { prisma } from "@/lib/prisma";
import { isBossIdentity } from "@/lib/rbac";
import { sendPushToUser } from "@/lib/push";

type AppUser = { id: string; role: Role; email?: string | null };
type NotificationInput = {
  recipientUserId: string;
  title: string;
  message: string;
  type: string;
  severity: NotificationSeverity;
  relatedModule: string;
  relatedRecordId?: string;
  url: string;
  metadata?: Record<string, unknown>;
};

const HIGH_AMOUNT = Number(process.env.BOSS_NOTIFICATION_AMOUNT_THRESHOLD ?? 10000);

export async function createNotification(input: NotificationInput) {
  const existing = input.relatedRecordId
    ? await prisma.notification.findFirst({
        where: {
          recipientUserId: input.recipientUserId,
          type: input.type,
          relatedRecordId: input.relatedRecordId,
          isRead: false
        }
      })
    : null;
  if (existing) return existing;

  const notification = await prisma.notification.create({
    data: {
      recipientUserId: input.recipientUserId,
      title: input.title,
      message: input.message,
      type: input.type,
      severity: input.severity,
      relatedModule: input.relatedModule,
      relatedRecordId: input.relatedRecordId,
      metadata: { ...(input.metadata ?? {}), url: input.url }
    }
  });

  await sendPushToUser({
    userId: input.recipientUserId,
    title: pushTitle(input.type),
    body: pushBody(input.type),
    url: input.url,
    severity: input.severity
  });
  return notification;
}

export async function notifySubmitted(input: {
  entity: "advance" | "expense" | "purchase";
  recordId: string;
  projectId: string;
  submittedById: string;
  amount: number;
  hasReceipt?: boolean;
}) {
  const recipients = await submissionRecipients(input.projectId, input.amount);
  const module = input.entity === "advance" ? "advances" : input.entity === "expense" ? "expenses" : "purchases";
  const title = `notifications.${input.entity}Submitted.title`;
  const message = `notifications.${input.entity}Submitted.message`;
  await Promise.all(
    recipients
      .filter((recipient) => recipient.id !== input.submittedById)
      .map((recipient) =>
        createNotification({
          recipientUserId: recipient.id,
          title,
          message,
          type: `${input.entity.toUpperCase()}_SUBMITTED`,
          severity: input.amount >= HIGH_AMOUNT ? "CRITICAL" : "WARNING",
          relatedModule: module,
          relatedRecordId: input.recordId,
          url: `/${module}`,
          metadata: { projectId: input.projectId }
        })
      )
  );

  if ((input.entity === "expense" || input.entity === "purchase") && !input.hasReceipt) {
    await Promise.all(
      recipients.map((recipient) =>
        createNotification({
          recipientUserId: recipient.id,
          title: "notifications.missingReceipt.title",
          message: "notifications.missingReceipt.message",
          type: "MISSING_RECEIPT",
          severity: "WARNING",
          relatedModule: module,
          relatedRecordId: input.recordId,
          url: `/${module}`,
          metadata: { projectId: input.projectId }
        })
      )
    );
  }
}

export async function notifyApprovalDecision(input: {
  entity: "advance" | "expense" | "purchase";
  recordId: string;
  requesterId: string;
  status: ApprovalStatus;
}) {
  if (input.status === "PENDING") return;
  const module = input.entity === "advance" ? "advances" : input.entity === "expense" ? "expenses" : "purchases";
  const result = input.status === "REJECTED" ? "Rejected" : "Approved";
  await createNotification({
    recipientUserId: input.requesterId,
    title: `notifications.${input.entity}${result}.title`,
    message: `notifications.${input.entity}${result}.message`,
    type: `${input.entity.toUpperCase()}_${result.toUpperCase()}`,
    severity: input.status === "REJECTED" ? "WARNING" : "INFO",
    relatedModule: module,
    relatedRecordId: input.recordId,
    url: `/${module}`
  });
}

export async function ensureSystemNotificationsForUser(user: AppUser) {
  const now = new Date();
  const soon = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  const jobs: Promise<unknown>[] = [];

  if (["BOSS", "GENERAL_MANAGER", "FINANCIAL_DEPARTMENT", "ACCOUNTANT", "SUPER_ADMIN", "ADMIN"].includes(user.role)) {
    const [supplierInvoices, taxes] = await Promise.all([
      prisma.supplierInvoice.findMany({ where: { dueDate: { lt: now } }, include: { supplier: true }, take: 20 }),
      prisma.taxObligation.findMany({ where: { dueDate: { lt: now } }, take: 20 })
    ]);
    supplierInvoices.forEach((invoice) => {
      const outstanding = Number(invoice.amount) - Number(invoice.paidAmount);
      if (outstanding <= 0) return;
      if (user.role === "BOSS" && outstanding < HIGH_AMOUNT) return;
      jobs.push(
        createNotification({
          recipientUserId: user.id,
          title: "notifications.supplierOverdue.title",
          message: "notifications.supplierOverdue.message",
          type: "SUPPLIER_OVERDUE",
          severity: outstanding >= HIGH_AMOUNT ? "CRITICAL" : "WARNING",
          relatedModule: "suppliers",
          relatedRecordId: invoice.id,
          url: "/suppliers"
        })
      );
    });
    taxes.forEach((tax) => {
      if (Number(tax.amountDue) - Number(tax.paid) <= 0) return;
      jobs.push(
        createNotification({
          recipientUserId: user.id,
          title: "notifications.taxOverdue.title",
          message: "notifications.taxOverdue.message",
          type: "TAX_OVERDUE",
          severity: "CRITICAL",
          relatedModule: "taxes",
          relatedRecordId: tax.id,
          url: "/taxes"
        })
      );
    });
  }

  if (["BOSS", "GENERAL_MANAGER", "FLEET_MANAGER", "SUPER_ADMIN", "ADMIN"].includes(user.role)) {
    const vehicles = await prisma.vehicle.findMany({
      where: { OR: [{ oilChangeDue: { lte: soon } }, { insuranceDue: { lte: soon } }, { inspectionDue: { lte: soon } }] },
      take: 20
    });
    vehicles.forEach((vehicle) => {
      jobs.push(
        createNotification({
          recipientUserId: user.id,
          title: "notifications.vehicleDue.title",
          message: "notifications.vehicleDue.message",
          type: "VEHICLE_DUE",
          severity: vehicle.oilChangeDue && vehicle.oilChangeDue < now ? "CRITICAL" : "WARNING",
          relatedModule: "fleet",
          relatedRecordId: vehicle.id,
          url: "/fleet"
        })
      );
    });
  }

  if (["GENERAL_MANAGER", "WAREHOUSE_MANAGER", "SUPER_ADMIN", "ADMIN"].includes(user.role)) {
    const items = (await prisma.inventoryItem.findMany()).filter((item) => item.quantity <= item.lowStockAt).slice(0, 20);
    items.forEach((item) => {
      jobs.push(
        createNotification({
          recipientUserId: user.id,
          title: "notifications.lowStock.title",
          message: "notifications.lowStock.message",
          type: "WAREHOUSE_LOW_STOCK",
          severity: "WARNING",
          relatedModule: "warehouse",
          relatedRecordId: item.id,
          url: "/warehouse"
        })
      );
    });
  }

  await Promise.all(jobs);
}

export async function getNotificationBadgeCounts(user: AppUser) {
  const projectIds = await projectIdsForUser(user);
  const projectWhere = projectIds ? { projectId: { in: projectIds } } : {};
  const now = new Date();
  const soon = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  const [
    advances,
    purchases,
    expenses,
    suppliers,
    taxes,
    fleet,
    warehouseItems,
    criticalProjects
  ] = await Promise.all([
    canSee(user.role, "advances") ? prisma.advanceRequest.count({ where: { status: "PENDING", ...projectWhere } }) : 0,
    canSee(user.role, "purchases") ? prisma.purchase.count({ where: { status: "PENDING", ...projectWhere } }) : 0,
    canSee(user.role, "expenses") ? prisma.expense.count({ where: { status: "PENDING", ...projectWhere } }) : 0,
    canSee(user.role, "suppliers") ? overdueSupplierCount() : 0,
    canSee(user.role, "taxes") ? prisma.taxObligation.count({ where: { dueDate: { lte: now } } }) : 0,
    canSee(user.role, "fleet") ? prisma.vehicle.count({ where: { OR: [{ oilChangeDue: { lte: soon } }, { insuranceDue: { lte: soon } }, { inspectionDue: { lte: soon } }] } }) : 0,
    canSee(user.role, "warehouse") ? lowStockCount() : 0,
    isBossIdentity(user.role, user.email) ? criticalProjectCount() : 0
  ]);

  return {
    "/advances": { count: advances, severity: "warning" as const },
    "/purchases": { count: purchases, severity: "warning" as const },
    "/expenses": { count: expenses, severity: "warning" as const },
    "/suppliers": { count: suppliers, severity: "critical" as const },
    "/taxes": { count: taxes, severity: "critical" as const },
    "/fleet": { count: fleet, severity: "warning" as const },
    "/warehouse": { count: warehouseItems, severity: "warning" as const },
    "/boss-room": { count: criticalProjects, severity: "critical" as const }
  };
}

async function submissionRecipients(projectId: string, amount: number) {
  const recipients = await prisma.user.findMany({
    where: {
      active: true,
      OR: [
        { role: { in: ["FINANCIAL_DEPARTMENT", "ACCOUNTANT", "GENERAL_MANAGER", "SUPER_ADMIN", "ADMIN"] } },
        { role: "PROJECT_MANAGER", projectAssignments: { some: { projectId } } },
        ...(amount >= HIGH_AMOUNT ? [{ role: "BOSS" as Role }] : [])
      ]
    },
    select: { id: true, role: true, email: true }
  });
  return dedupeUsers(recipients.filter((user) => user.role !== "BOSS" || isBossIdentity(user.role, user.email)));
}

function dedupeUsers<T extends { id: string }>(users: T[]) {
  return Array.from(new Map(users.map((user) => [user.id, user])).values());
}

function canSee(role: Role, module: string) {
  if (["BOSS", "GENERAL_MANAGER", "SUPER_ADMIN", "ADMIN"].includes(role)) return true;
  if (["FINANCIAL_DEPARTMENT", "ACCOUNTANT"].includes(role)) return ["advances", "purchases", "expenses", "suppliers", "taxes"].includes(module);
  if (role === "PROJECT_MANAGER") return ["advances", "purchases", "expenses"].includes(module);
  if (role === "FLEET_MANAGER") return module === "fleet";
  if (role === "WAREHOUSE_MANAGER") return module === "warehouse";
  return false;
}

async function overdueSupplierCount() {
  const invoices = await prisma.supplierInvoice.findMany({ where: { dueDate: { lt: new Date() } } });
  return invoices.filter((invoice) => Number(invoice.amount) > Number(invoice.paidAmount)).length;
}

async function lowStockCount() {
  const items = await prisma.inventoryItem.findMany();
  return items.filter((item) => item.quantity <= item.lowStockAt).length;
}

async function criticalProjectCount() {
  const projects = await prisma.project.findMany({ select: { contractValue: true, actualCost: true } });
  return projects.filter((project) => Number(project.actualCost) > Number(project.contractValue)).length;
}

function pushTitle(type: string) {
  if (type.includes("TAX")) return "Critical: tax overdue";
  if (type.includes("SUPPLIER")) return "Supplier overdue";
  if (type.includes("VEHICLE")) return "Vehicle maintenance due";
  if (type.includes("WAREHOUSE")) return "Warehouse low stock";
  if (type.includes("ADVANCE")) return "Advance request update";
  if (type.includes("EXPENSE")) return "Expense update";
  if (type.includes("PURCHASE")) return "Work purchase update";
  return "ScadaCom ERP notification";
}

function pushBody(type: string) {
  if (type.endsWith("SUBMITTED")) return "A new item is awaiting review.";
  if (type.includes("OVERDUE")) return "A critical item needs attention.";
  if (type.includes("DUE")) return "A maintenance deadline needs attention.";
  return "Open ScadaCom ERP to review.";
}
