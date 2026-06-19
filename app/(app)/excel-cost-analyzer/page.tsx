import { AlertTriangle, CheckCircle2, Download, FileSpreadsheet, ShieldCheck } from "lucide-react";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { auth } from "@/auth";
import { ExcelCostUploadForm } from "@/components/excel-cost-upload-form";
import { PageHeader } from "@/components/page-header";
import {
  approveExcelCostImport,
  assignExcelCostRowProject,
  rejectExcelCostImport,
  remapExcelCostColumns,
  selectExcelCostSheets
} from "@/app/actions";
import { projectIdsForUser } from "@/lib/access";
import {
  canApproveExcelCostImport,
  canManageExcelCostAnalyzer,
  canViewExcelCostAnalyzer,
  excelCostFieldLabels,
  excelCostFields,
  type ExcelCostField
} from "@/lib/excel-cost-analyzer";
import { getTranslator } from "@/lib/i18n-server";
import { mad } from "@/lib/money";
import { prisma } from "@/lib/prisma";

type PageProps = {
  searchParams?: Promise<{ importId?: string }>;
};

export default async function ExcelCostAnalyzerPage({ searchParams }: PageProps) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!canViewExcelCostAnalyzer(session.user.role)) redirect("/dashboard");

  const { t } = await getTranslator();
  const params = await searchParams;
  const canManage = canManageExcelCostAnalyzer(session.user.role);
  const canApprove = canApproveExcelCostImport(session.user.role);
  const projectIds = canManage ? undefined : await projectIdsForUser(session.user);
  const visibilityWhere = projectIds ? { siteRows: { some: { matchedProjectId: { in: projectIds } } } } : {};

  const imports = await prisma.excelImport.findMany({
    where: visibilityWhere,
    orderBy: { uploadedAt: "desc" },
    take: 12,
    include: {
      uploadedBy: { select: { name: true, role: true } },
      summary: true,
      sheets: { orderBy: { sheetName: "asc" } }
    }
  });

  const selectedImportId = params?.importId ?? imports[0]?.id;
  const selectedImport = selectedImportId
    ? await prisma.excelImport.findFirst({
        where: { id: selectedImportId, ...visibilityWhere },
        include: {
          uploadedBy: { select: { name: true, role: true } },
          summary: true,
          sheets: { orderBy: { sheetName: "asc" } }
        }
      })
    : null;

  const rowWhere = {
    importId: selectedImport?.id ?? "__none__",
    ...(projectIds ? { matchedProjectId: { in: projectIds } } : {})
  };
  const rows = selectedImport
    ? await prisma.excelSiteCostRow.findMany({
        where: rowWhere,
        orderBy: [{ sheetName: "asc" }, { rowNumber: "asc" }],
        include: { matchedProject: { select: { id: true, name: true, siteId: true } } }
      })
    : [];
  const projects = canManage
    ? await prisma.project.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, siteId: true, client: true } })
    : [];

  const visibleSummary = buildVisibleSummary(rows);
  const headers = Array.from(new Set(selectedImport?.sheets.flatMap((sheet) => (Array.isArray(sheet.headers) ? sheet.headers.map(String) : [])) ?? []));
  const columnMapping = (selectedImport?.columnMapping ?? {}) as Partial<Record<ExcelCostField, string>>;
  const importableRows = rows.filter((row) => row.matchedProjectId && Number(row.totalCost) > 0 && !["DUPLICATE", "REJECTED", "IMPORTED"].includes(row.status));

  return (
    <>
      <PageHeader
        titleKey="pages.excelCostAnalyzer.title"
        descriptionKey="pages.excelCostAnalyzer.description"
        action={selectedImport ? (
          <div className="flex flex-wrap gap-2">
            <a className="inline-flex items-center gap-2 rounded-md border border-black/10 bg-white px-3 py-2 text-sm font-semibold text-ink" href={`/api/excel-cost-analyzer/${selectedImport.id}/export?format=xlsx`}>
              <Download size={16} /> Excel
            </a>
            <a className="inline-flex items-center gap-2 rounded-md border border-black/10 bg-white px-3 py-2 text-sm font-semibold text-ink" href={`/api/excel-cost-analyzer/${selectedImport.id}/export?format=pdf`}>
              <Download size={16} /> PDF
            </a>
          </div>
        ) : null}
      />

      <div className="mb-5 flex gap-2 overflow-x-auto pb-1 text-sm">
        {["Upload File", "Workbook Structure", "Section Detection", "Mapping", "Site Cost Preview", "Profitability Analysis", "Red Flags", "Manual Corrections", "Import Approval", "Reports"].map((tab) => (
          <a key={tab} href={`#${slug(tab)}`} className="whitespace-nowrap rounded-full border border-black/10 bg-white px-3 py-2 font-semibold text-stone-700">
            {tab}
          </a>
        ))}
      </div>

      {canManage ? <div id="upload-file"><ExcelCostUploadForm /></div> : (
        <section id="upload-file" className="rounded-lg border border-black/10 bg-white p-5 text-sm text-stone-600 shadow-sm">
          Project managers can view assigned-project import data only. Upload, mapping, and approval are limited to Boss, General Manager, and Finance roles.
        </section>
      )}

      <section className="mt-6 rounded-lg border border-black/10 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-ink">Upload history</h2>
        <div className="mt-4 grid gap-3">
          {imports.length ? imports.map((item) => (
            <a key={item.id} href={`/excel-cost-analyzer?importId=${item.id}`} className={`rounded-md border p-3 text-sm transition hover:border-mint ${selectedImport?.id === item.id ? "border-mint bg-field" : "border-black/10 bg-white"}`}>
              <div className="flex flex-col justify-between gap-2 md:flex-row md:items-center">
                <div>
                  <p className="font-semibold text-ink">{item.fileName}</p>
                  <p className="mt-1 text-stone-600">
                    {item.uploadedBy.name} / {item.uploadedAt.toLocaleString("fr-MA")} / {item.sheets.length} sheet(s)
                  </p>
                </div>
                <StatusPill status={item.status} />
              </div>
            </a>
          )) : (
            <EmptyState text="No Excel cost analysis has been uploaded yet." />
          )}
        </div>
      </section>

      {selectedImport ? (
        <>
          <section className="mt-6 grid gap-4 md:grid-cols-4">
            <MetricCard label="Total rows" value={visibleSummary.totalRows.toLocaleString("fr-MA")} />
            <MetricCard label="Total site cost" value={mad(visibleSummary.totalCost)} />
            <MetricCard label="Duplicates" value={visibleSummary.duplicateRows.toLocaleString("fr-MA")} tone={visibleSummary.duplicateRows ? "warning" : "neutral"} />
            <MetricCard label="Unmatched" value={visibleSummary.unmatchedRows.toLocaleString("fr-MA")} tone={visibleSummary.unmatchedRows ? "warning" : "neutral"} />
          </section>

          <section id="workbook-structure" className="mt-6 rounded-lg border border-black/10 bg-white p-5 shadow-sm">
            <SectionTitle icon={<FileSpreadsheet size={20} />} title="Workbook Structure" description="Detected sheets and section titles are stored for audit. Change selected sheets and re-run analysis before approval." />
            <form action={selectExcelCostSheets} className="mt-4 grid gap-3">
              <input type="hidden" name="importId" value={selectedImport.id} />
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {selectedImport.sheets.map((sheet) => (
                  <label key={sheet.id} className="flex items-center justify-between gap-3 rounded-md border border-black/10 p-3 text-sm">
                    <span>
                      <span className="font-semibold text-ink">{sheet.sheetName}</span>
                      <span className="mt-1 block text-stone-500">{sheet.rowCount} site cost row(s)</span>
                    </span>
                    <input name="selectedSheets" value={sheet.sheetName} type="checkbox" defaultChecked={sheet.selected} disabled={!canManage} />
                  </label>
                ))}
              </div>
              {canManage ? <button className="w-fit rounded-md bg-ink px-4 py-2 text-sm font-semibold text-white">Update selected sheets</button> : null}
            </form>
          </section>

          <section id="section-detection" className="mt-6 rounded-lg border border-black/10 bg-white p-5 shadow-sm">
            <SectionTitle icon={<FileSpreadsheet size={20} />} title="Section Detection" description="The analyzer detects merged titles, changing section headers, salary blocks, fuel blocks, purchase blocks, and unknown sections." />
            <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {selectedImport.sheets.flatMap((sheet) => {
                const sections = Array.isArray(sheet.detectedSections) ? sheet.detectedSections as Array<Record<string, unknown>> : [];
                return sections.map((section, index) => (
                  <div key={`${sheet.id}-${index}`} className="rounded-md border border-black/10 p-3 text-sm">
                    <p className="font-semibold text-ink">{String(section.title ?? "Untitled section")}</p>
                    <p className="mt-1 text-stone-600">{sheet.sheetName} / rows {String(section.startRow ?? "-")} - {String(section.endRow ?? "-")}</p>
                    <p className="mt-1 text-stone-500">Category hint: {String(section.category ?? "Unknown")}</p>
                  </div>
                ));
              })}
              {selectedImport.sheets.every((sheet) => !Array.isArray(sheet.detectedSections) || sheet.detectedSections.length === 0) ? <EmptyState text="No section titles detected. The analyzer will still use header mapping and row content." /> : null}
            </div>
          </section>

          <section id="mapping" className="mt-6 rounded-lg border border-black/10 bg-white p-5 shadow-sm">
            <SectionTitle icon={<ShieldCheck size={20} />} title="Mapping" description="Auto-detected fields can be corrected before the import is approved. Saved mappings become the reusable import profile." />
            <form action={remapExcelCostColumns} className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              <input type="hidden" name="importId" value={selectedImport.id} />
              {excelCostFields.map((field) => (
                <label key={field} className="grid gap-2 text-sm">
                  <span className="font-semibold text-stone-700">{excelCostFieldLabels[field]}</span>
                  <select name={field} defaultValue={columnMapping[field] ?? ""} disabled={!canManage} className="rounded-md border border-black/10 bg-white px-3 py-2">
                    <option value="">Not mapped</option>
                    {headers.map((header) => <option key={`${field}-${header}`} value={header}>{header}</option>)}
                  </select>
                </label>
              ))}
              {canManage ? <button className="rounded-md bg-ink px-4 py-2 text-sm font-semibold text-white md:col-span-2 xl:col-span-3">Re-analyze with mapping</button> : null}
            </form>
          </section>

          <section id="site-cost-preview" className="mt-6 rounded-lg border border-black/10 bg-white p-5 shadow-sm">
            <SectionTitle icon={<FileSpreadsheet size={20} />} title="Site Cost Preview" description="Preview rows do not affect project cost until Boss or Finance approves the import." />
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[1100px] text-left text-sm">
                <thead className="bg-field text-xs uppercase text-stone-500">
                  <tr>
                    <th className="px-3 py-2">Sheet</th>
                    <th className="px-3 py-2">Row</th>
                    <th className="px-3 py-2">Site</th>
                    <th className="px-3 py-2">Project</th>
                    <th className="px-3 py-2">Team</th>
                    <th className="px-3 py-2">Days</th>
                    <th className="px-3 py-2">Revenue</th>
                    <th className="px-3 py-2">Cost</th>
                    <th className="px-3 py-2">Profit</th>
                    <th className="px-3 py-2">Margin</th>
                    <th className="px-3 py-2">Status</th>
                    <th className="px-3 py-2">Red flags</th>
                    {canManage ? <th className="px-3 py-2">Assign</th> : null}
                  </tr>
                </thead>
                <tbody>
                  {rows.slice(0, 80).map((row) => (
                    <tr key={row.id} className="border-t border-black/10 align-top">
                      <td className="px-3 py-3">{row.sheetName}</td>
                      <td className="px-3 py-3">{row.rowNumber}</td>
                      <td className="px-3 py-3">{row.siteId ?? "-"}</td>
                      <td className="px-3 py-3">{row.matchedProject?.name ?? row.projectName ?? "-"}</td>
                      <td className="px-3 py-3">{row.teamName ?? "-"}</td>
                      <td className="px-3 py-3">{row.workDays == null ? "-" : Number(row.workDays).toLocaleString("fr-MA")}</td>
                      <td className="px-3 py-3">{row.revenue == null ? "Missing" : mad(row.revenue)}</td>
                      <td className="px-3 py-3 font-semibold">{mad(row.totalCost)}</td>
                      <td className="px-3 py-3">{row.profitLoss == null ? "-" : mad(row.profitLoss)}</td>
                      <td className="px-3 py-3">{row.marginPercent == null ? "-" : `${Number(row.marginPercent).toLocaleString("fr-MA")}%`}</td>
                      <td className="px-3 py-3"><StatusPill status={row.status} /></td>
                      <td className="px-3 py-3">
                        <FlagList flags={Array.isArray(row.warnings) ? row.warnings.map(String) : []} />
                      </td>
                      {canManage ? (
                        <td className="px-3 py-3">
                          <form action={assignExcelCostRowProject} className="flex min-w-64 gap-2">
                            <input type="hidden" name="rowId" value={row.id} />
                            <select name="projectId" defaultValue={row.matchedProjectId ?? ""} className="min-w-0 flex-1 rounded-md border border-black/10 px-2 py-1">
                              <option value="">Choose project</option>
                              {projects.map((project) => (
                                <option key={project.id} value={project.id}>{project.name} / {project.siteId}</option>
                              ))}
                            </select>
                            <button className="rounded-md bg-field px-3 py-1 font-semibold text-ink">Save</button>
                          </form>
                        </td>
                      ) : null}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {rows.length > 80 ? <p className="mt-3 text-sm text-stone-500">Showing first 80 rows. Export the report for the full dataset.</p> : null}
          </section>

          <section id="profitability-analysis" className="mt-6 rounded-lg border border-black/10 bg-white p-5 shadow-sm">
            <SectionTitle icon={<CheckCircle2 size={20} />} title="Profitability Analysis" description="Totals exclude duplicate/rejected rows. Approved costs and pending preview costs stay separated until approval." />
            <div className="mt-4 grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
              <Breakdown title="Cost per site" entries={visibleSummary.bySite} />
              <Breakdown title="Cost by category" entries={visibleSummary.byCategory} />
              <Breakdown title="Cost by project" entries={visibleSummary.byProject} />
              <Breakdown title="Cost by team" entries={visibleSummary.byTeam} />
              <Breakdown title="Revenue by site" entries={visibleSummary.revenueBySite} />
              <Breakdown title="Highest cost sites" entries={visibleSummary.bySite.slice(0, 8)} />
            </div>
          </section>

          <section id="red-flags" className="mt-6 rounded-lg border border-black/10 bg-white p-5 shadow-sm">
            <SectionTitle icon={<AlertTriangle size={20} />} title="Red Flags" description="Fix unmatched rows, duplicates, unknown categories, allowance mismatches, loss-making sites, and missing data before final approval." />
            <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {visibleSummary.redFlags.length ? visibleSummary.redFlags.map(([flag, count]) => (
                <div key={flag} className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">
                  <p className="font-semibold">{flag}</p>
                  <p className="mt-1">{count} row(s)</p>
                </div>
              )) : <EmptyState text="No red flags detected in visible rows." />}
            </div>
          </section>

          <section id="manual-corrections" className="mt-6 rounded-lg border border-black/10 bg-white p-5 shadow-sm">
            <SectionTitle icon={<ShieldCheck size={20} />} title="Manual Corrections" description="Assign unmatched site rows to ERP projects here. Corrected mappings can be saved and reused for future monthly files." />
            <p className="mt-4 text-sm text-stone-600">Use the project selector in Site Cost Preview for unmatched rows. Imported Excel data does not affect ERP project cost until approval.</p>
          </section>

          <section id="import-approval" className="mt-6 rounded-lg border border-black/10 bg-white p-5 shadow-sm">
            <SectionTitle icon={<ShieldCheck size={20} />} title="Import Approval" description="Approval creates approved ERP expenses from total site costs and recalculates only the matched projects." />
            <div className="mt-4 rounded-md border border-dashed border-black/20 bg-field p-4 text-sm">
              <p className="font-semibold text-ink">Safe preview status</p>
              <p className="mt-1 text-stone-600">This Excel import has not changed live project costs unless the status is IMPORTED.</p>
              <p className="mt-2 text-stone-700">{importableRows.length} matched positive row(s) are ready for approval. Duplicates, rejected rows, and unmatched rows are skipped.</p>
            </div>
            <div className="mt-4 flex flex-col gap-3 md:flex-row">
              {canApprove && !["IMPORTED", "REJECTED"].includes(selectedImport.status) ? (
                <form action={approveExcelCostImport} className="flex flex-1 flex-col gap-2 md:flex-row">
                  <input type="hidden" name="importId" value={selectedImport.id} />
                  <input name="reason" placeholder="Approval note" className="min-w-0 flex-1 rounded-md border border-black/10 px-3 py-2 text-sm" />
                  <button className="rounded-md bg-mint px-4 py-2 text-sm font-semibold text-white">Approve and import costs</button>
                </form>
              ) : null}
              {canManage && !["IMPORTED", "REJECTED"].includes(selectedImport.status) ? (
                <form action={rejectExcelCostImport} className="flex flex-1 flex-col gap-2 md:flex-row">
                  <input type="hidden" name="importId" value={selectedImport.id} />
                  <input name="reason" placeholder="Reject reason" className="min-w-0 flex-1 rounded-md border border-black/10 px-3 py-2 text-sm" />
                  <button className="rounded-md border border-red-200 bg-red-50 px-4 py-2 text-sm font-semibold text-red-700">Reject import</button>
                </form>
              ) : null}
            </div>
          </section>

          <section id="reports" className="mt-6 rounded-lg border border-black/10 bg-white p-5 shadow-sm">
            <SectionTitle icon={<Download size={20} />} title="Reports" description="Export audit-ready reports for cost per site, project, category, unmatched rows, duplicates, and red flags." />
            <div className="mt-4 flex flex-wrap gap-3">
              <ReportLink href={`/api/excel-cost-analyzer/${selectedImport.id}/export?format=xlsx`} label="Excel Cost Analysis Report" />
              <ReportLink href={`/api/excel-cost-analyzer/${selectedImport.id}/export?format=pdf`} label="PDF Red Flags Report" />
            </div>
          </section>
        </>
      ) : null}
    </>
  );
}

function MetricCard({ label, value, tone = "neutral" }: { label: string; value: string; tone?: "neutral" | "warning" }) {
  return (
    <div className={`rounded-lg border p-5 shadow-sm ${tone === "warning" ? "border-amber-200 bg-amber-50" : "border-black/10 bg-white"}`}>
      <p className="text-sm font-medium text-stone-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-ink">{value}</p>
    </div>
  );
}

function SectionTitle({ icon, title, description }: { icon: ReactNode; title: string; description: string }) {
  return (
    <div className="flex items-start gap-3">
      <span className="mt-0.5 text-mint">{icon}</span>
      <div>
        <h2 className="text-lg font-semibold text-ink">{title}</h2>
        <p className="mt-1 text-sm text-stone-600">{description}</p>
      </div>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const tone = status === "IMPORTED" || status === "MATCHED" || status === "APPROVED"
    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
    : status === "DUPLICATE" || status === "UNMATCHED" || status === "REJECTED"
      ? "bg-amber-50 text-amber-800 border-amber-200"
      : "bg-stone-50 text-stone-700 border-stone-200";
  return <span className={`inline-flex rounded-full border px-2 py-1 text-xs font-bold ${tone}`}>{status}</span>;
}

function FlagList({ flags }: { flags: string[] }) {
  if (!flags.length) return <span className="text-stone-400">None</span>;
  return (
    <div className="flex flex-wrap gap-1">
      {flags.map((flag) => <span key={flag} className="rounded-full bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-800">{flag}</span>)}
    </div>
  );
}

function Breakdown({ title, entries }: { title: string; entries: Array<[string, number]> }) {
  return (
    <div className="rounded-md border border-black/10 p-4">
      <p className="font-semibold text-ink">{title}</p>
      <div className="mt-3 grid gap-2 text-sm">
        {entries.length ? entries.slice(0, 10).map(([label, amount]) => (
          <div key={label} className="flex items-center justify-between gap-4">
            <span className="truncate text-stone-600">{label}</span>
            <span className="font-semibold text-ink">{mad(amount)}</span>
          </div>
        )) : <span className="text-stone-400">No data</span>}
      </div>
    </div>
  );
}

function ReportLink({ href, label }: { href: string; label: string }) {
  return (
    <a href={href} className="inline-flex items-center gap-2 rounded-md border border-black/10 bg-white px-4 py-2 text-sm font-semibold text-ink">
      <Download size={16} /> {label}
    </a>
  );
}

function EmptyState({ text }: { text: string }) {
  return <p className="rounded-md border border-dashed border-stone-300 p-4 text-sm text-stone-500">{text}</p>;
}

function buildVisibleSummary(rows: Array<{
  totalCost: unknown;
  revenue: unknown;
  fuelCost: unknown;
  highwayCost: unknown;
  salaryAllocatedCost: unknown;
  dailyAllowanceCost: unknown;
  purchaseCost: unknown;
  materialCost: unknown;
  toolCost: unknown;
  vehicleCost: unknown;
  paperPrintingCost: unknown;
  otherCost: unknown;
  unknownCost: unknown;
  status: string;
  siteId: string | null;
  projectName: string | null;
  warnings: unknown;
  mappedData: unknown;
  matchedProject?: { name: string } | null;
}>) {
  const usable = rows.filter((row) => !["DUPLICATE", "REJECTED"].includes(row.status) && Number(row.totalCost ?? 0) > 0);
  const bySite = totals(usable, (row) => row.siteId ?? "Missing site");
  const byProject = totals(usable, (row) => row.matchedProject?.name ?? row.projectName ?? "Unmatched");
  const byCategory = categoryTotals(usable);
  const byTeam = totals(usable, (row) => String(((row.mappedData as Record<string, unknown> | null)?.teamName ?? "Missing team")));
  const revenueBySite = revenueTotals(usable, (row) => row.siteId ?? "Missing site");
  const redFlags = new Map<string, number>();

  for (const row of rows) {
    const flags = Array.isArray(row.warnings) ? row.warnings.map(String) : [];
    for (const flag of flags) redFlags.set(flag, (redFlags.get(flag) ?? 0) + 1);
  }

  return {
    totalRows: rows.length,
    totalCost: usable.reduce((sum, row) => sum + Number(row.totalCost ?? 0), 0),
    duplicateRows: rows.filter((row) => row.status === "DUPLICATE").length,
    unmatchedRows: rows.filter((row) => row.status === "UNMATCHED").length,
    bySite,
    byProject,
    byCategory,
    byTeam,
    revenueBySite,
    redFlags: Array.from(redFlags.entries()).sort((a, b) => b[1] - a[1])
  };
}

function totals<T>(rows: T[], labelFor: (row: T) => string): Array<[string, number]> {
  const map = new Map<string, number>();
  for (const row of rows as Array<T & { totalCost: unknown }>) {
    const label = labelFor(row) || "Missing";
    map.set(label, (map.get(label) ?? 0) + Number(row.totalCost ?? 0));
  }
  return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
}

function revenueTotals<T>(rows: T[], labelFor: (row: T) => string): Array<[string, number]> {
  const map = new Map<string, number>();
  for (const row of rows as Array<T & { revenue: unknown }>) {
    const label = labelFor(row) || "Missing";
    map.set(label, (map.get(label) ?? 0) + Number(row.revenue ?? 0));
  }
  return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
}

function categoryTotals(rows: Array<{ fuelCost: unknown; highwayCost: unknown; salaryAllocatedCost: unknown; dailyAllowanceCost: unknown; purchaseCost: unknown; materialCost: unknown; toolCost: unknown; vehicleCost: unknown; paperPrintingCost: unknown; otherCost: unknown; unknownCost: unknown }>): Array<[string, number]> {
  const totalsMap = new Map<string, number>();
  const add = (label: string, value: unknown) => totalsMap.set(label, (totalsMap.get(label) ?? 0) + Number(value ?? 0));
  for (const row of rows) {
    add("Fuel", row.fuelCost);
    add("Highway", row.highwayCost);
    add("Salary", row.salaryAllocatedCost);
    add("Daily allowance", row.dailyAllowanceCost);
    add("Purchases", row.purchaseCost);
    add("Materials", row.materialCost);
    add("Tools", row.toolCost);
    add("Vehicle", row.vehicleCost);
    add("Paper/printing", row.paperPrintingCost);
    add("Other", row.otherCost);
    add("Unknown", row.unknownCost);
  }
  return Array.from(totalsMap.entries()).filter(([, amount]) => amount > 0).sort((a, b) => b[1] - a[1]);
}

function slug(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}
