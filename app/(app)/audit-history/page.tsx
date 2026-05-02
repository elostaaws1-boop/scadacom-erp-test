import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { PageHeader } from "@/components/page-header";
import { T } from "@/components/translated-text";
import { auditVisibilityFilter, canViewAuditHistory } from "@/lib/audit-access";
import { getTranslator } from "@/lib/i18n-server";
import { prisma } from "@/lib/prisma";
import { roleLabels } from "@/lib/rbac";

const modules = ["Project", "Mission", "Expense", "Purchase", "AdvanceRequest", "CashMovement", "Supplier", "SupplierInvoice", "TaxObligation", "InventoryItem", "StockMovement", "Vehicle", "LocationUpdate", "BossAiAssistant", "MonthlyPerformanceReport", "Invite"];
const actions = ["CREATE", "UPDATE", "SUBMIT", "APPROVE", "REJECT", "PARTIALLY_APPROVED", "ARCHIVE", "DELETE", "IMPORT_EXCEL", "BOSS_AI_ASSISTANT_QUERY", "LOCK_MONTHLY_REPORT", "GENERATE_MONTHLY_REPORT"];

export default async function AuditHistoryPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const session = await auth();
  if (!session?.user || !canViewAuditHistory(session.user)) notFound();
  const params = await searchParams;
  const { t, locale } = await getTranslator();
  const filters = await auditVisibilityFilter(session.user);
  const where = {
    AND: [
      filters,
      params.module ? { module: params.module } : {},
      params.action ? { actionType: params.action } : {},
      params.role ? { performedByRole: params.role as never } : {},
      params.severity ? { severity: params.severity as never } : {},
      params.deleted === "true" ? { deletedRecord: true } : {},
      params.financial === "true" ? { financialAction: true } : {},
      params.q
        ? {
            OR: [
              { recordLabel: { contains: params.q, mode: "insensitive" as const } },
              { recordId: { contains: params.q, mode: "insensitive" as const } },
              { actionType: { contains: params.q, mode: "insensitive" as const } },
              { performedByName: { contains: params.q, mode: "insensitive" as const } }
            ]
          }
        : {},
      params.from ? { createdAt: { gte: new Date(params.from) } } : {},
      params.to ? { createdAt: { lte: new Date(params.to) } } : {}
    ]
  };
  const logs = await prisma.auditLog.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 200,
    include: { actor: true }
  });
  const users = await prisma.user.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, role: true } });

  return (
    <>
      <PageHeader titleKey="pages.auditHistory.title" descriptionKey="pages.auditHistory.description" />
      <form className="grid gap-3 rounded-lg border border-black/10 bg-white p-4 shadow-sm md:grid-cols-4 xl:grid-cols-8">
        <input className="rounded-md border border-stone-300 px-3 py-2 text-sm" name="q" defaultValue={params.q} placeholder={t("pages.auditHistory.search")} />
        <input className="rounded-md border border-stone-300 px-3 py-2 text-sm" name="from" type="date" defaultValue={params.from} />
        <input className="rounded-md border border-stone-300 px-3 py-2 text-sm" name="to" type="date" defaultValue={params.to} />
        <select className="rounded-md border border-stone-300 px-3 py-2 text-sm" name="module" defaultValue={params.module ?? ""}>
          <option value="">{t("pages.auditHistory.allModules")}</option>
          {modules.map((module) => <option key={module} value={module}>{module}</option>)}
        </select>
        <select className="rounded-md border border-stone-300 px-3 py-2 text-sm" name="action" defaultValue={params.action ?? ""}>
          <option value="">{t("pages.auditHistory.allActions")}</option>
          {actions.map((action) => <option key={action} value={action}>{action}</option>)}
        </select>
        <select className="rounded-md border border-stone-300 px-3 py-2 text-sm" name="role" defaultValue={params.role ?? ""}>
          <option value="">{t("pages.auditHistory.allRoles")}</option>
          {users.map((user) => <option key={`${user.role}-${user.id}`} value={user.role}>{t(roleLabels[user.role])}</option>)}
        </select>
        <select className="rounded-md border border-stone-300 px-3 py-2 text-sm" name="severity" defaultValue={params.severity ?? ""}>
          <option value="">{t("pages.auditHistory.allSeverity")}</option>
          <option value="INFO">{t("notifications.severity.INFO")}</option>
          <option value="WARNING">{t("notifications.severity.WARNING")}</option>
          <option value="CRITICAL">{t("notifications.severity.CRITICAL")}</option>
        </select>
        <button className="rounded-md bg-ink px-4 py-2 text-sm font-semibold text-white">{t("common.actions.apply")}</button>
        <label className="flex items-center gap-2 text-sm"><input name="deleted" type="checkbox" value="true" defaultChecked={params.deleted === "true"} /> {t("pages.auditHistory.deletedOnly")}</label>
        <label className="flex items-center gap-2 text-sm"><input name="financial" type="checkbox" value="true" defaultChecked={params.financial === "true"} /> {t("pages.auditHistory.financialOnly")}</label>
      </form>

      <div className="mt-5 overflow-x-auto rounded-lg border border-black/10 bg-white shadow-sm">
        <table className="min-w-full text-sm">
          <thead className="bg-field text-xs uppercase text-stone-500">
            <tr>
              <th className="px-4 py-3 text-start"><T k="pages.auditHistory.date" /></th>
              <th className="px-4 py-3 text-start"><T k="pages.auditHistory.user" /></th>
              <th className="px-4 py-3 text-start"><T k="common.fields.role" /></th>
              <th className="px-4 py-3 text-start"><T k="pages.auditHistory.module" /></th>
              <th className="px-4 py-3 text-start"><T k="pages.auditHistory.action" /></th>
              <th className="px-4 py-3 text-start"><T k="pages.auditHistory.record" /></th>
              <th className="px-4 py-3 text-start"><T k="pages.auditHistory.summary" /></th>
              <th className="px-4 py-3 text-start"><T k="pages.auditHistory.reason" /></th>
              <th className="px-4 py-3 text-start"><T k="pages.auditHistory.details" /></th>
            </tr>
          </thead>
          <tbody>
            {logs.map((log) => (
              <tr className="border-t border-black/10 align-top" key={log.id}>
                <td className="px-4 py-3 whitespace-nowrap">{log.createdAt.toLocaleString(locale === "ar" ? "ar" : locale === "fr" ? "fr" : "en")}</td>
                <td className="px-4 py-3">{log.performedByName ?? log.actor?.name ?? "-"}</td>
                <td className="px-4 py-3">{log.performedByRole ? t(roleLabels[log.performedByRole]) : "-"}</td>
                <td className="px-4 py-3">{log.module ?? log.entity}</td>
                <td className="px-4 py-3"><span className={severityClass(log.severity)}>{log.actionType ?? log.action}</span></td>
                <td className="px-4 py-3">{log.recordLabel ?? log.recordId ?? log.entityId ?? "-"}</td>
                <td className="max-w-sm px-4 py-3">{log.changeSummary ?? "-"}</td>
                <td className="max-w-xs px-4 py-3">{log.reason ?? "-"}</td>
                <td className="px-4 py-3">
                  <details>
                    <summary className="cursor-pointer font-semibold text-mint">{t("pages.auditHistory.view")}</summary>
                    <div className="mt-2 grid gap-2 text-xs">
                      <pre className="max-h-48 overflow-auto rounded bg-field p-2">{JSON.stringify({ oldValue: log.oldValue ?? log.before, newValue: log.newValue ?? log.after }, null, 2)}</pre>
                      <p>{t("pages.auditHistory.ip")}: {log.ip ?? "-"}</p>
                      <p>{t("pages.auditHistory.device")}: {log.userAgent ?? "-"}</p>
                    </div>
                  </details>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function severityClass(severity: string) {
  if (severity === "CRITICAL") return "rounded-full bg-red-100 px-2 py-1 text-xs font-bold text-red-700";
  if (severity === "WARNING") return "rounded-full bg-amber-100 px-2 py-1 text-xs font-bold text-amber-800";
  return "rounded-full bg-sky-100 px-2 py-1 text-xs font-bold text-sky-700";
}
