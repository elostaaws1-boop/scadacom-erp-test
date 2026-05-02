"use client";

import { useActionState, useState, type FormEvent } from "react";
import { useFormStatus } from "react-dom";
import { translate, type Locale } from "@/lib/i18n";
import type { BossIntelligenceLayer, IntelligenceSeverity } from "@/lib/boss-ai";
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
  intelligence: BossIntelligenceLayer;
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

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
  meta?: string;
};

export function BossRoomConsole({ projects, intelligence, reports, unlock, simulate, generateReport, lockReport }: BossRoomConsoleProps) {
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
      <IntelligenceLayerPanel intelligence={intelligence} projects={projects} />
      <AiAssistantPanel passcode={passcode} />
      <MonthlyReportsPanel reports={reports} generateReport={generateReport} lockReport={lockReport} />
    </section>
  );
}

function IntelligenceLayerPanel({ intelligence, projects }: { intelligence: BossIntelligenceLayer; projects: ProjectOption[] }) {
  const locale = useClientLocale();
  const [projectFilter, setProjectFilter] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("all");
  const [timeFilter, setTimeFilter] = useState("all");
  const selectedProject = projects.find((project) => project.id === projectFilter)?.name ?? "";

  const redFlags = intelligence.redFlags.filter((item) => matchesProject(item.relatedLabel, selectedProject) && matchesDepartment(item.module, departmentFilter));
  const rootCauses = intelligence.rootCauses.filter((item) => {
    const linkedProjects = item.linkedTo.projects ?? [];
    return matchesProject(linkedProjects.join(" "), selectedProject);
  });
  const predictions = intelligence.predictions.filter((item) => matchesTime(item.timeEstimate, timeFilter));
  const suggestions = intelligence.suggestions.filter((item) => matchesProject(item.relatedLabel, selectedProject) && matchesDepartment(item.module, departmentFilter));

  return (
    <section className="rounded-lg border border-black/10 bg-white p-5 shadow-sm">
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-mint">{translate(locale, "pages.bossIntelligence.eyebrow")}</p>
          <h2 className="mt-2 text-2xl font-semibold text-ink">{translate(locale, "pages.bossIntelligence.title")}</h2>
          <p className="mt-1 text-sm text-stone-600">{translate(locale, "pages.bossIntelligence.description")}</p>
        </div>
        <div className="grid gap-2 sm:grid-cols-3">
          <select className="rounded-md border border-stone-300 px-3 py-2 text-sm" value={projectFilter} onChange={(event) => setProjectFilter(event.target.value)}>
            <option value="">{translate(locale, "pages.bossIntelligence.filters.allProjects")}</option>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>{project.name}</option>
            ))}
          </select>
          <select className="rounded-md border border-stone-300 px-3 py-2 text-sm" value={departmentFilter} onChange={(event) => setDepartmentFilter(event.target.value)}>
            <option value="all">{translate(locale, "pages.bossIntelligence.filters.allDepartments")}</option>
            <option value="finance">{translate(locale, "pages.bossIntelligence.modules.finance")}</option>
            <option value="projects">{translate(locale, "pages.bossIntelligence.modules.projects")}</option>
            <option value="operations">{translate(locale, "pages.bossIntelligence.modules.operations")}</option>
            <option value="fleet">{translate(locale, "pages.bossIntelligence.modules.fleet")}</option>
            <option value="warehouse">{translate(locale, "pages.bossIntelligence.modules.warehouse")}</option>
            <option value="suppliers">{translate(locale, "pages.bossIntelligence.modules.suppliers")}</option>
            <option value="taxes">{translate(locale, "pages.bossIntelligence.modules.taxes")}</option>
          </select>
          <select className="rounded-md border border-stone-300 px-3 py-2 text-sm" value={timeFilter} onChange={(event) => setTimeFilter(event.target.value)}>
            <option value="all">{translate(locale, "pages.bossIntelligence.filters.allTime")}</option>
            <option value="now">{translate(locale, "pages.bossIntelligence.filters.thisMonth")}</option>
            <option value="next30">{translate(locale, "pages.bossIntelligence.filters.next30")}</option>
          </select>
        </div>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-6">
        <OverviewMetric label={translate(locale, "pages.bossIntelligence.overview.cash")} value={money(intelligence.companyOverview.cash)} />
        <OverviewMetric label={translate(locale, "pages.bossIntelligence.overview.projects")} value={intelligence.companyOverview.openProjects} />
        <OverviewMetric label={translate(locale, "pages.bossIntelligence.overview.expenses")} value={money(intelligence.companyOverview.monthlyExpenses)} />
        <OverviewMetric label={translate(locale, "pages.bossIntelligence.overview.fleet")} value={intelligence.companyOverview.fleetAlerts} />
        <OverviewMetric label={translate(locale, "pages.bossIntelligence.overview.warehouse")} value={intelligence.companyOverview.warehouseLowStock} />
        <OverviewMetric label={translate(locale, "pages.bossIntelligence.overview.pending")} value={intelligence.companyOverview.pendingApprovals} />
      </div>

      <div className="mt-5 grid gap-4 xl:grid-cols-2">
        <LevelPanel level="1" title={translate(locale, "pages.bossIntelligence.levels.overview")} description={translate(locale, "pages.bossIntelligence.levelDescriptions.overview")}>
          <p className="text-sm text-stone-600">{translate(locale, "pages.bossIntelligence.period", { period: intelligence.periodLabel })}</p>
          <ul className="mt-3 space-y-2 text-sm text-stone-700">
            {intelligence.companyOverview.dataNotes.map((note) => <li key={note}>{note}</li>)}
          </ul>
        </LevelPanel>

        <LevelPanel level="2" title={translate(locale, "pages.bossIntelligence.levels.redFlags")} description={translate(locale, "pages.bossIntelligence.levelDescriptions.redFlags")}>
          <InsightList items={redFlags.map((item) => ({
            id: item.id,
            title: item.title,
            description: item.description,
            severity: item.severity,
            meta: moduleLabel(locale, item.module),
            reasoning: item.reasoning
          }))} />
        </LevelPanel>

        <LevelPanel level="3" title={translate(locale, "pages.bossIntelligence.levels.rootCause")} description={translate(locale, "pages.bossIntelligence.levelDescriptions.rootCause")}>
          <InsightList items={rootCauses.map((item) => ({
            id: item.id,
            title: item.title,
            description: linkedLabels(item.linkedTo) || translate(locale, "pages.bossIntelligence.noLinkedRecords"),
            severity: item.severity,
            meta: translate(locale, "pages.bossIntelligence.reasoning"),
            reasoning: item.reasoning
          }))} />
        </LevelPanel>

        <LevelPanel level="4" title={translate(locale, "pages.bossIntelligence.levels.predictions")} description={translate(locale, "pages.bossIntelligence.levelDescriptions.predictions")}>
          <InsightList items={predictions.map((item) => ({
            id: item.id,
            title: item.title,
            description: `${item.description} ${translate(locale, "pages.bossIntelligence.confidence")}: ${confidenceLabel(locale, item.confidence)}. ${translate(locale, "pages.bossIntelligence.timeEstimate")}: ${item.timeEstimate}.`,
            severity: item.severity,
            meta: translate(locale, "pages.bossIntelligence.prediction"),
            reasoning: item.reasoning
          }))} />
        </LevelPanel>

        <LevelPanel level="5" title={translate(locale, "pages.bossIntelligence.levels.suggestions")} description={translate(locale, "pages.bossIntelligence.levelDescriptions.suggestions")}>
          <InsightList items={suggestions.map((item) => ({
            id: item.id,
            title: item.action,
            description: `${translate(locale, "pages.bossIntelligence.reason")}: ${item.reason}`,
            severity: item.severity,
            meta: `${translate(locale, "pages.bossIntelligence.expectedImpact")}: ${item.expectedImpact}`,
            reasoning: item.expectedImpact
          }))} />
        </LevelPanel>

        <LevelPanel level="6" title={translate(locale, "pages.bossIntelligence.levels.roleAssistance")} description={translate(locale, "pages.bossIntelligence.levelDescriptions.roleAssistance")}>
          <div className="rounded-md bg-field p-3 text-sm text-stone-700">
            <p className="font-semibold text-ink">{translate(locale, "pages.bossIntelligence.bossControlled")}</p>
            <p className="mt-1">{intelligence.roleAssistance.note}</p>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {intelligence.roleAssistance.suggestedPrompts.map((prompt) => (
              <span className="rounded-full border border-black/10 px-3 py-1 text-xs font-medium text-stone-600" key={prompt}>{prompt}</span>
            ))}
          </div>
        </LevelPanel>
      </div>

      <div className="mt-5 rounded-md bg-field p-3 text-xs text-stone-600">
        <span className="font-semibold text-ink">{translate(locale, "pages.bossIntelligence.dataBasis")}:</span> {intelligence.dataBasis.join(", ")}
      </div>
    </section>
  );
}

function OverviewMetric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-black/10 bg-field p-3">
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-stone-500">{label}</p>
      <p className="mt-2 text-xl font-semibold text-ink">{value}</p>
    </div>
  );
}

function LevelPanel({ level, title, description, children }: { level: string; title: string; description: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-black/10 p-4">
      <div className="flex items-start gap-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-ink text-sm font-semibold text-white">{level}</span>
        <div>
          <h3 className="text-lg font-semibold text-ink">{title}</h3>
          <p className="mt-1 text-sm text-stone-600">{description}</p>
        </div>
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function InsightList({
  items
}: {
  items: Array<{ id: string; title: string; description: string; severity: IntelligenceSeverity; meta: string; reasoning: string }>;
}) {
  const locale = useClientLocale();
  if (!items.length) {
    return <p className="rounded-md border border-dashed border-stone-300 p-3 text-sm text-stone-500">{translate(locale, "pages.bossIntelligence.noFilteredResults")}</p>;
  }

  return (
    <div className="space-y-3">
      {items.map((item) => (
        <article className="rounded-md border border-black/10 p-3" key={item.id}>
          <div className="flex flex-wrap items-start justify-between gap-2">
            <h4 className="font-semibold text-ink">{item.title}</h4>
            <span className={`rounded-full px-2 py-1 text-xs font-semibold ${severityClass(item.severity)}`}>{severityLabel(locale, item.severity)}</span>
          </div>
          <p className="mt-2 text-sm leading-6 text-stone-700">{item.description}</p>
          <p className="mt-2 text-xs font-semibold uppercase tracking-[0.12em] text-stone-500">{item.meta}</p>
          <p className="mt-1 text-xs leading-5 text-stone-500">{item.reasoning}</p>
        </article>
      ))}
    </div>
  );
}

function AiAssistantPanel({ passcode }: { passcode: string }) {
  const locale = useClientLocale();
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "assistant",
      content: translate(locale, "pages.bossAi.welcome"),
      meta: translate(locale, "pages.bossAi.private")
    }
  ]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const prompts = [
    translate(locale, "pages.bossAi.prompts.performance"),
    translate(locale, "pages.bossAi.prompts.redFlags"),
    translate(locale, "pages.bossAi.prompts.riskyProjects"),
    translate(locale, "pages.bossAi.prompts.reduceCosts"),
    translate(locale, "pages.bossAi.prompts.actionPlan")
  ];

  async function askAssistant(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = question.trim();
    if (!trimmed || loading) return;
    setError("");
    setLoading(true);
    setQuestion("");
    setMessages((current) => [...current, { role: "user", content: trimmed }]);

    try {
      const response = await fetch("/api/boss-ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: trimmed, passcode, locale })
      });
      const payload = (await response.json().catch(() => null)) as { answer?: string; model?: string; usedFallback?: boolean; error?: string } | null;
      if (!response.ok || !payload?.answer) throw new Error(payload?.error || translate(locale, "pages.bossAi.error"));
      setMessages((current) => [
        ...current,
        {
          role: "assistant",
          content: payload.answer ?? "",
          meta: payload.usedFallback ? translate(locale, "pages.bossAi.ruleBased") : `${translate(locale, "pages.bossAi.model")}: ${payload.model}`
        }
      ]);
    } catch (assistantError) {
      setError(assistantError instanceof Error ? assistantError.message : translate(locale, "pages.bossAi.error"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="rounded-lg border border-black/10 bg-white p-5 shadow-sm">
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-mint">{translate(locale, "pages.bossAi.eyebrow")}</p>
          <h2 className="mt-2 text-2xl font-semibold text-ink">{translate(locale, "pages.bossAi.title")}</h2>
          <p className="mt-1 text-sm text-stone-600">{translate(locale, "pages.bossAi.description")}</p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {prompts.map((prompt) => (
          <button
            className="rounded-full border border-black/10 px-3 py-2 text-sm font-medium text-stone-700 transition hover:border-mint hover:text-mint"
            key={prompt}
            onClick={() => setQuestion(prompt)}
            type="button"
          >
            {prompt}
          </button>
        ))}
      </div>

      <div className="mt-4 max-h-[420px] space-y-3 overflow-y-auto rounded-lg bg-field p-3">
        {messages.map((message, index) => (
          <div className={`rounded-lg border border-black/10 p-3 ${message.role === "user" ? "ms-auto max-w-3xl bg-white" : "me-auto max-w-4xl bg-emerald-50"}`} key={`${message.role}-${index}`}>
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-stone-500">
              {message.role === "user" ? translate(locale, "pages.bossAi.you") : translate(locale, "pages.bossAi.assistantName")}
            </p>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-ink">{message.content}</p>
            {message.meta ? <p className="mt-2 text-xs text-stone-500">{message.meta}</p> : null}
          </div>
        ))}
        {loading ? <p className="rounded-lg border border-black/10 bg-white p-3 text-sm font-medium text-stone-600">{translate(locale, "pages.bossAi.thinking")}</p> : null}
      </div>

      <form className="mt-4 grid gap-3 md:grid-cols-[1fr_auto]" onSubmit={askAssistant}>
        <textarea
          className="min-h-24 rounded-md border border-stone-300 px-3 py-3"
          onChange={(event) => setQuestion(event.target.value)}
          placeholder={translate(locale, "pages.bossAi.placeholder")}
          value={question}
        />
        <button className="rounded-md bg-ink px-5 py-3 font-semibold text-white disabled:cursor-wait disabled:opacity-70" disabled={loading || !question.trim()} type="submit">
          {loading ? translate(locale, "pages.bossAi.asking") : translate(locale, "pages.bossAi.ask")}
        </button>
      </form>
      {error ? <p className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700">{error}</p> : null}
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

function matchesProject(value: string | undefined, selectedProject: string) {
  if (!selectedProject) return true;
  return Boolean(value?.toLowerCase().includes(selectedProject.toLowerCase()));
}

function matchesDepartment(module: string, department: string) {
  return department === "all" || module === department;
}

function matchesTime(timeEstimate: string, timeFilter: string) {
  if (timeFilter === "all") return true;
  if (timeFilter === "now") return timeEstimate.toLowerCase().includes("this");
  return timeEstimate.toLowerCase().includes("30") || timeEstimate.toLowerCase().includes("week");
}

function linkedLabels(linkedTo: { projects?: string[]; teams?: string[]; suppliers?: string[]; vehicles?: string[] }) {
  return [linkedTo.projects, linkedTo.teams, linkedTo.suppliers, linkedTo.vehicles].flatMap((values) => values ?? []).join(", ");
}

function severityClass(severity: IntelligenceSeverity) {
  if (severity === "critical") return "bg-red-50 text-red-700";
  if (severity === "warning") return "bg-amber-50 text-amber-700";
  return "bg-emerald-50 text-emerald-700";
}

function severityLabel(locale: Locale, severity: IntelligenceSeverity) {
  if (severity === "critical") return translate(locale, "pages.bossIntelligence.severity.critical");
  if (severity === "warning") return translate(locale, "pages.bossIntelligence.severity.warning");
  return translate(locale, "pages.bossIntelligence.severity.info");
}

function confidenceLabel(locale: Locale, confidence: "high" | "medium" | "low") {
  if (confidence === "high") return translate(locale, "pages.bossIntelligence.confidenceLevels.high");
  if (confidence === "medium") return translate(locale, "pages.bossIntelligence.confidenceLevels.medium");
  return translate(locale, "pages.bossIntelligence.confidenceLevels.low");
}

function moduleLabel(locale: Locale, module: string) {
  if (module === "finance") return translate(locale, "pages.bossIntelligence.modules.finance");
  if (module === "projects") return translate(locale, "pages.bossIntelligence.modules.projects");
  if (module === "operations") return translate(locale, "pages.bossIntelligence.modules.operations");
  if (module === "fleet") return translate(locale, "pages.bossIntelligence.modules.fleet");
  if (module === "warehouse") return translate(locale, "pages.bossIntelligence.modules.warehouse");
  if (module === "suppliers") return translate(locale, "pages.bossIntelligence.modules.suppliers");
  return translate(locale, "pages.bossIntelligence.modules.taxes");
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
