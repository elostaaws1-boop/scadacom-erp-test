"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { translate, type Locale } from "@/lib/i18n";
import type { MonthlyReportSnapshot } from "@/lib/monthly-report";
import { useClientLocale } from "@/components/translated-text";

type ProjectOption = {
  id: string;
  name: string;
};

export type UnlockState = {
  ok: boolean;
  error?: string;
};

type BossRoomConsoleProps = {
  projects: ProjectOption[];
  reports: MonthlyReportOption[];
  unlock: (state: UnlockState, formData: FormData) => Promise<UnlockState>;
  simulate: (formData: FormData) => Promise<void>;
  generateReport: (formData: FormData) => Promise<void>;
  lockReport: (formData: FormData) => Promise<void>;
};

type MonthlyReportOption = {
  id: string;
  month: number;
  year: number;
  status: string;
  generatedAt: string | null;
  lockedAt: string | null;
  snapshot: unknown;
};

export function BossRoomConsole({ projects, reports, unlock, simulate, generateReport, lockReport }: BossRoomConsoleProps) {
  const [passcode, setPasscode] = useState("");
  const [state, unlockAction] = useActionState(unlock, { ok: false });
  const locale = useClientLocale();

  if (!state.ok) {
    return (
      <section className="max-w-xl rounded-lg border border-black/10 bg-white p-6 shadow-sm">
        <div className="mb-6">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-mint">{translate(locale, "pages.bossRoom.privateAccess")}</p>
          <h2 className="mt-2 text-2xl font-semibold text-ink">{translate(locale, "pages.bossRoom.enterPasscode")}</h2>
          <p className="mt-2 text-sm text-stone-600">{translate(locale, "pages.bossRoom.lockedDescription")}</p>
        </div>
        <form action={unlockAction} className="space-y-4">
          <label className="block text-sm font-medium text-ink">
            {translate(locale, "pages.bossRoom.passcode")}
            <input
              autoFocus
              className="focus-ring mt-2 w-full rounded-md border border-stone-300 px-3 py-3 text-lg"
              name="passcode"
              type="password"
              inputMode="numeric"
              value={passcode}
              onChange={(event) => setPasscode(event.target.value)}
              required
            />
          </label>
          {state.error ? <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700">{translate(locale, state.error)}</p> : null}
          <UnlockButton />
        </form>
      </section>
    );
  }

  return (
    <section className="space-y-5">
      <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">{translate(locale, "pages.bossRoom.unlocked")}</div>
      <form action={simulate} className="grid max-w-4xl gap-3 rounded-lg border border-black/10 bg-white p-5 shadow-sm md:grid-cols-2">
        <input name="passcode" type="hidden" value={passcode} />
        <select name="projectId" className="rounded-md border border-stone-300 px-3 py-3">
          <option value="">{translate(locale, "pages.bossRoom.runWithoutSaving")}</option>
          {projects.map((project) => (
            <option value={project.id} key={project.id}>
              {project.name}
            </option>
          ))}
        </select>
        <input name="name" placeholder={translate(locale, "pages.bossRoom.scenarioName")} className="rounded-md border border-stone-300 px-3 py-3" />
        <input name="revenue" type="number" step="0.01" min="0" placeholder={translate(locale, "pages.bossRoom.revenueMad")} required className="rounded-md border border-stone-300 px-3 py-3" />
        <input name="manualCost" type="number" step="0.01" min="0" placeholder={translate(locale, "pages.bossRoom.manualCostMad")} required className="rounded-md border border-stone-300 px-3 py-3" />
        <ScenarioButton />
      </form>
      <MonthlyReportsPanel reports={reports} generateReport={generateReport} lockReport={lockReport} />
    </section>
  );
}

function MonthlyReportsPanel({
  reports,
  generateReport,
  lockReport
}: {
  reports: MonthlyReportOption[];
  generateReport: (formData: FormData) => Promise<void>;
  lockReport: (formData: FormData) => Promise<void>;
}) {
  const locale = useClientLocale();
  const current = reports[0];
  const snapshot = current?.snapshot as MonthlyReportSnapshot | undefined;
  const now = new Date();

  return (
    <section className="rounded-lg border border-black/10 bg-white p-5 shadow-sm">
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-mint">{translate(locale, "pages.monthlyReports.eyebrow")}</p>
          <h2 className="mt-2 text-2xl font-semibold text-ink">{translate(locale, "pages.monthlyReports.title")}</h2>
          <p className="mt-1 text-sm text-stone-600">{translate(locale, "pages.monthlyReports.description")}</p>
        </div>
        <form action={generateReport} className="grid gap-2 sm:grid-cols-[120px_120px_auto]">
          <select name="month" defaultValue={now.getMonth() + 1} className="rounded-md border border-stone-300 px-3 py-3">
            {Array.from({ length: 12 }, (_, index) => (
              <option value={index + 1} key={index + 1}>{monthName(index + 1, locale)}</option>
            ))}
          </select>
          <input name="year" type="number" min="2020" max="2100" defaultValue={now.getFullYear()} className="rounded-md border border-stone-300 px-3 py-3" />
          <GenerateReportButton />
        </form>
      </div>

      {snapshot ? (
        <div className="mt-5 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-md bg-field p-3">
            <div>
              <p className="font-semibold">{snapshot.period.label}</p>
              <p className="text-sm text-stone-600">{reportStatusLabel(locale, current.status)} {current.lockedAt ? ` / ${new Date(current.lockedAt).toLocaleDateString()}` : ""}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <a className="rounded-md border border-black/10 px-3 py-2 text-sm font-semibold" href={`/api/monthly-reports/${current.id}/export?format=pdf`}>{translate(locale, "pages.monthlyReports.exportPdf")}</a>
              <a className="rounded-md border border-black/10 px-3 py-2 text-sm font-semibold" href={`/api/monthly-reports/${current.id}/export?format=xlsx`}>{translate(locale, "pages.monthlyReports.exportExcel")}</a>
              {current.status !== "LOCKED" ? (
                <form action={lockReport}>
                  <input type="hidden" name="id" value={current.id} />
                  <LockReportButton />
                </form>
              ) : null}
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <ReportCard label={translate(locale, "pages.monthlyReports.totalRevenue")} value={money(snapshot.financial.totalRevenue)} trend={snapshot.comparison.revenueChange} positiveGood />
            <ReportCard label={translate(locale, "pages.monthlyReports.totalExpenses")} value={money(snapshot.financial.totalExpenses)} trend={snapshot.comparison.costChange} />
            <ReportCard label={translate(locale, "pages.monthlyReports.totalProfit")} value={money(snapshot.financial.totalProfit)} trend={snapshot.comparison.profitChange} positiveGood />
            <ReportCard label={translate(locale, "pages.monthlyReports.profitMargin")} value={`${snapshot.financial.profitMargin}%`} />
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            <ReportSection title={translate(locale, "pages.monthlyReports.financialSummary")}>
              <KeyValue label={translate(locale, "pages.monthlyReports.cashInflow")} value={money(snapshot.financial.cashInflow)} />
              <KeyValue label={translate(locale, "pages.monthlyReports.cashOutflow")} value={money(snapshot.financial.cashOutflow)} />
              <KeyValue label={translate(locale, "pages.monthlyReports.supplierPayments")} value={money(snapshot.financial.supplierPaymentsTotal)} />
              <KeyValue label={translate(locale, "pages.monthlyReports.taxPayments")} value={money(snapshot.financial.taxPaymentsTotal)} />
              <KeyValue label={translate(locale, "pages.monthlyReports.supplierDebt")} value={money(snapshot.financial.outstandingSupplierDebt)} />
              <KeyValue label={translate(locale, "pages.monthlyReports.outstandingTaxes")} value={money(snapshot.financial.outstandingTaxes)} />
            </ReportSection>
            <ReportSection title={translate(locale, "pages.monthlyReports.projectPerformance")}>
              <KeyValue label={translate(locale, "pages.monthlyReports.activeProjects")} value={snapshot.projectPerformance.totalActiveProjects} />
              <KeyValue label={translate(locale, "pages.monthlyReports.completedProjects")} value={snapshot.projectPerformance.completedProjects} />
              <KeyValue label={translate(locale, "pages.monthlyReports.mostProfitable")} value={snapshot.projectPerformance.mostProfitableProject ?? "-"} />
              <KeyValue label={translate(locale, "pages.monthlyReports.leastProfitable")} value={snapshot.projectPerformance.leastProfitableProject ?? "-"} />
              <KeyValue label={translate(locale, "pages.monthlyReports.averageMargin")} value={`${snapshot.projectPerformance.averageProjectMargin}%`} />
              <KeyValue label={translate(locale, "pages.monthlyReports.lossProjects")} value={snapshot.projectPerformance.lossMakingProjects.length} />
            </ReportSection>
          </div>

          <div className="grid gap-4 xl:grid-cols-3">
            <BarList title={translate(locale, "pages.monthlyReports.expensesByCategory")} rows={snapshot.expenseAnalysis.byCategory.map((row) => ({ label: row.category, value: row.total }))} />
            <BarList title={translate(locale, "pages.monthlyReports.topCostProjects")} rows={snapshot.expenseAnalysis.topCostProjects.map((row) => ({ label: row.project, value: row.cost }))} />
            <BarList title={translate(locale, "pages.monthlyReports.teamEfficiency")} rows={snapshot.operational.teamEfficiency.map((row) => ({ label: row.team, value: row.costPerMission }))} />
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            <ReportSection title={translate(locale, "pages.monthlyReports.operationalPerformance")}>
              <KeyValue label={translate(locale, "pages.monthlyReports.totalMissions")} value={snapshot.operational.totalMissions} />
              <KeyValue label={translate(locale, "pages.monthlyReports.completedMissions")} value={snapshot.operational.completedMissions} />
              <KeyValue label={translate(locale, "pages.monthlyReports.delayedMissions")} value={snapshot.operational.delayedMissions} />
              <KeyValue label={translate(locale, "pages.monthlyReports.averageMissionDuration")} value={snapshot.operational.averageMissionDuration} />
              <KeyValue label={translate(locale, "pages.monthlyReports.expensesWithoutReceipts")} value={snapshot.expenseAnalysis.expensesWithoutReceipts} />
            </ReportSection>
            <ReportSection title={translate(locale, "pages.monthlyReports.alertsForecast")}>
              <KeyValue label={translate(locale, "pages.monthlyReports.redFlags")} value={snapshot.alerts.redFlags} />
              <KeyValue label={translate(locale, "pages.monthlyReports.unresolvedAlerts")} value={snapshot.alerts.unresolved} />
              <KeyValue label={translate(locale, "pages.monthlyReports.expectedProfit")} value={money(snapshot.forecast.expectedNextMonthProfit)} />
              <KeyValue label={translate(locale, "pages.monthlyReports.riskLevel")} value={impactLabel(locale, snapshot.forecast.riskLevel)} />
              <p className="mt-3 rounded-md bg-field p-3 text-sm text-stone-700">{snapshot.forecast.cashStabilityForecast}</p>
            </ReportSection>
          </div>

          <ReportSection title={translate(locale, "pages.monthlyReports.smartInsights")}>
            <div className="grid gap-3 md:grid-cols-3">
              {snapshot.insights.map((insight) => (
                <div className="rounded-md border border-black/10 p-3" key={`${insight.title}-${insight.description}`}>
                  <span className={`rounded-full px-2 py-1 text-xs font-semibold ${impactClass(insight.impact)}`}>{impactLabel(locale, insight.impact)}</span>
                  <p className="mt-3 font-semibold">{insight.title}</p>
                  <p className="mt-1 text-sm text-stone-600">{insight.description}</p>
                </div>
              ))}
            </div>
          </ReportSection>
        </div>
      ) : (
        <p className="mt-5 rounded-md border border-dashed border-stone-300 p-4 text-sm text-stone-500">{translate(locale, "pages.monthlyReports.noReports")}</p>
      )}
    </section>
  );
}

function UnlockButton() {
  const { pending } = useFormStatus();
  const locale = useClientLocale();

  return (
    <button className="w-full rounded-md bg-ink px-4 py-3 font-semibold text-white disabled:cursor-wait disabled:opacity-70" disabled={pending} type="submit">
      {pending ? translate(locale, "pages.bossRoom.unlocking") : translate(locale, "pages.bossRoom.unlock")}
    </button>
  );
}

function ScenarioButton() {
  const { pending } = useFormStatus();
  const locale = useClientLocale();

  return (
    <button className="rounded-md bg-ink px-4 py-3 font-semibold text-white disabled:cursor-wait disabled:opacity-70 md:col-span-2" disabled={pending} type="submit">
      {pending ? translate(locale, "pages.bossRoom.running") : translate(locale, "pages.bossRoom.runScenario")}
    </button>
  );
}

function GenerateReportButton() {
  const { pending } = useFormStatus();
  const locale = useClientLocale();
  return <button className="rounded-md bg-ink px-4 py-3 font-semibold text-white disabled:cursor-wait disabled:opacity-70" disabled={pending}>{pending ? translate(locale, "pages.monthlyReports.generating") : translate(locale, "pages.monthlyReports.generate")}</button>;
}

function LockReportButton() {
  const { pending } = useFormStatus();
  const locale = useClientLocale();
  return <button className="rounded-md bg-ink px-3 py-2 text-sm font-semibold text-white disabled:cursor-wait disabled:opacity-70" disabled={pending}>{pending ? translate(locale, "pages.monthlyReports.locking") : translate(locale, "pages.monthlyReports.lock")}</button>;
}

function ReportCard({ label, value, trend, positiveGood = false }: { label: string; value: string; trend?: number; positiveGood?: boolean }) {
  const good = trend === undefined ? false : positiveGood ? trend >= 0 : trend <= 0;
  return (
    <div className="rounded-lg border border-black/10 p-4">
      <p className="text-sm text-stone-600">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-ink">{value}</p>
      {trend !== undefined ? <p className={`mt-2 text-sm font-semibold ${good ? "text-emerald-700" : "text-red-700"}`}>{trend}%</p> : null}
    </div>
  );
}

function ReportSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-black/10 p-4">
      <h3 className="text-lg font-semibold">{title}</h3>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function KeyValue({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 border-b border-black/10 py-2 text-sm">
      <span className="text-stone-600">{label}</span>
      <span className="font-semibold text-ink">{value}</span>
    </div>
  );
}

function BarList({ title, rows }: { title: string; rows: Array<{ label: string; value: number }> }) {
  const max = Math.max(...rows.map((row) => row.value), 1);
  return (
    <section className="rounded-lg border border-black/10 p-4">
      <h3 className="text-lg font-semibold">{title}</h3>
      <div className="mt-3 space-y-3">
        {rows.length > 0 ? rows.map((row) => (
          <div key={row.label}>
            <div className="flex justify-between gap-2 text-sm">
              <span>{row.label}</span>
              <span className="font-semibold">{money(row.value)}</span>
            </div>
            <div className="mt-1 h-2 overflow-hidden rounded-full bg-field">
              <div className="h-full rounded-full bg-mint" style={{ width: `${Math.max(4, (row.value / max) * 100)}%` }} />
            </div>
          </div>
        )) : <p className="text-sm text-stone-500">-</p>}
      </div>
    </section>
  );
}

function money(value: number) {
  return `${Number(value || 0).toLocaleString("fr-MA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} MAD`;
}

function monthName(month: number, locale: string) {
  return new Date(Date.UTC(2026, month - 1, 1)).toLocaleString(locale === "ar" ? "ar" : locale === "fr" ? "fr" : "en", { month: "long", timeZone: "UTC" });
}

function impactClass(impact: "high" | "medium" | "low") {
  if (impact === "high") return "bg-red-50 text-red-700";
  if (impact === "medium") return "bg-amber-50 text-amber-700";
  return "bg-emerald-50 text-emerald-700";
}

function reportStatusLabel(locale: Locale, status: string) {
  if (status === "DRAFT") return translate(locale, "pages.monthlyReports.status.DRAFT");
  if (status === "LOCKED") return translate(locale, "pages.monthlyReports.status.LOCKED");
  if (status === "ARCHIVED") return translate(locale, "pages.monthlyReports.status.ARCHIVED");
  return translate(locale, "pages.monthlyReports.status.GENERATED");
}

function impactLabel(locale: Locale, impact: "high" | "medium" | "low") {
  if (impact === "high") return translate(locale, "pages.monthlyReports.impact.high");
  if (impact === "medium") return translate(locale, "pages.monthlyReports.impact.medium");
  return translate(locale, "pages.monthlyReports.impact.low");
}
