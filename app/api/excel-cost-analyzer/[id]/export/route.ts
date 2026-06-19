import ExcelJS from "exceljs";
import jsPDF from "jspdf";
import { NextRequest } from "next/server";
import { auth } from "@/auth";
import { projectIdsForUser } from "@/lib/access";
import { audit } from "@/lib/audit";
import { canViewExcelCostAnalyzer } from "@/lib/excel-cost-analyzer";
import { mad } from "@/lib/money";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user || !canViewExcelCostAnalyzer(session.user.role)) return new Response("Unauthorized", { status: 401 });
  const { id } = await params;
  const projectIds = ["BOSS", "GENERAL_MANAGER", "FINANCIAL_DEPARTMENT", "SUPER_ADMIN", "ADMIN", "ACCOUNTANT"].includes(session.user.role)
    ? undefined
    : await projectIdsForUser(session.user);

  const excelImport = await prisma.excelImport.findFirst({
    where: {
      id,
      ...(projectIds ? { siteRows: { some: { matchedProjectId: { in: projectIds } } } } : {})
    },
    include: {
      uploadedBy: { select: { name: true } },
      sheets: { orderBy: { sheetName: "asc" } },
      siteRows: {
        where: projectIds ? { matchedProjectId: { in: projectIds } } : {},
        orderBy: [{ sheetName: "asc" }, { rowNumber: "asc" }],
        include: { matchedProject: { select: { name: true, siteId: true } } }
      }
    }
  });
  if (!excelImport) return new Response("Not found", { status: 404 });

  const format = request.nextUrl.searchParams.get("format") ?? "xlsx";
  await audit({
    actorId: session.user.id,
    action: `EXPORT_EXCEL_COST_${format.toUpperCase()}`,
    entity: "ExcelImport",
    entityId: excelImport.id,
    after: { fileName: excelImport.fileName, rows: excelImport.siteRows.length, format },
    financialAction: true
  });

  if (format === "pdf") return exportPdf(excelImport);
  return exportXlsx(excelImport);
}

async function exportXlsx(excelImport: NonNullable<Awaited<ReturnType<typeof getImportTypeHelper>>>) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "ScadaCom ERP";
  workbook.created = new Date();

  const summary = buildSummary(excelImport.siteRows);
  const summarySheet = workbook.addWorksheet("Summary");
  summarySheet.columns = [
    { header: "Metric", key: "metric", width: 32 },
    { header: "Value", key: "value", width: 28 }
  ];
  summarySheet.addRows([
    { metric: "File name", value: excelImport.fileName },
    { metric: "Uploaded by", value: excelImport.uploadedBy.name },
    { metric: "Uploaded at", value: excelImport.uploadedAt.toISOString() },
    { metric: "Status", value: excelImport.status },
    { metric: "Rows", value: excelImport.siteRows.length },
    { metric: "Total cost", value: summary.totalCost },
    { metric: "Total revenue", value: summary.totalRevenue },
    { metric: "Total profit/loss", value: summary.totalProfitLoss },
    { metric: "Duplicate rows", value: summary.duplicateRows },
    { metric: "Unmatched rows", value: summary.unmatchedRows }
  ]);

  const rowsSheet = workbook.addWorksheet("Site Cost Rows");
  rowsSheet.columns = [
    { header: "Sheet", key: "sheetName", width: 24 },
    { header: "Row", key: "rowNumber", width: 8 },
    { header: "Site ID", key: "siteId", width: 18 },
    { header: "Project", key: "project", width: 32 },
    { header: "Team", key: "team", width: 24 },
    { header: "Work days", key: "workDays", width: 12 },
    { header: "Technicians", key: "technicianCount", width: 12 },
    { header: "Total cost MAD", key: "totalCost", width: 16 },
    { header: "Revenue MAD", key: "revenue", width: 16 },
    { header: "Profit/loss MAD", key: "profitLoss", width: 18 },
    { header: "Margin %", key: "marginPercent", width: 12 },
    { header: "Profitability", key: "profitabilityStatus", width: 20 },
    { header: "Status", key: "status", width: 16 },
    { header: "Warnings", key: "flags", width: 52 },
    { header: "Description", key: "description", width: 60 }
  ];
  excelImport.siteRows.forEach((row) => {
    const mapped = (row.mappedData ?? {}) as Record<string, unknown>;
    rowsSheet.addRow({
      sheetName: row.sheetName,
      rowNumber: row.rowNumber,
      siteId: row.siteId ?? "",
      project: row.matchedProject?.name ?? row.projectName ?? "",
      team: row.teamName ?? "",
      workDays: Number(row.workDays ?? 0),
      technicianCount: row.technicianCount ?? "",
      totalCost: Number(row.totalCost ?? 0),
      revenue: row.revenue == null ? "" : Number(row.revenue),
      profitLoss: row.profitLoss == null ? "" : Number(row.profitLoss),
      marginPercent: row.marginPercent == null ? "" : Number(row.marginPercent),
      profitabilityStatus: row.profitabilityStatus,
      status: row.status,
      flags: Array.isArray(row.warnings) ? row.warnings.join(", ") : "",
      description: String(mapped.description ?? "")
    });
  });

  addBreakdownSheet(workbook, "Cost per Site", summary.bySite);
  addBreakdownSheet(workbook, "Cost per Project", summary.byProject);
  addBreakdownSheet(workbook, "Category Breakdown", summary.byCategory);
  addBreakdownSheet(workbook, "Revenue per Site", summary.revenueBySite);
  addBreakdownSheet(workbook, "Red Flags", Object.fromEntries(summary.redFlags));
  addFilteredRowsSheet(workbook, "Unmatched Rows", excelImport.siteRows.filter((row) => row.status === "UNMATCHED"));
  addFilteredRowsSheet(workbook, "Duplicates", excelImport.siteRows.filter((row) => row.status === "DUPLICATE"));
  addFilteredRowsSheet(workbook, "Loss Making Sites", excelImport.siteRows.filter((row) => row.profitabilityStatus === "LOSS_MAKING"));

  const buffer = await workbook.xlsx.writeBuffer();
  return new Response(buffer, {
    headers: {
      "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "content-disposition": `attachment; filename=scadacom-excel-cost-analysis-${excelImport.id}.xlsx`
    }
  });
}

function exportPdf(excelImport: NonNullable<Awaited<ReturnType<typeof getImportTypeHelper>>>) {
  const doc = new jsPDF();
  const summary = buildSummary(excelImport.siteRows);
  doc.setFontSize(16);
  doc.text("ScadaCom ERP - Site Profitability Analysis", 14, 18);
  doc.setFontSize(10);
  doc.text(`File: ${excelImport.fileName}`, 14, 30);
  doc.text(`Uploaded by: ${excelImport.uploadedBy.name}`, 14, 37);
  doc.text(`Status: ${excelImport.status}`, 14, 44);
  doc.text(`Rows: ${excelImport.siteRows.length}`, 14, 51);
  doc.text(`Total cost: ${mad(summary.totalCost)}`, 14, 58);
  doc.text(`Total revenue: ${mad(summary.totalRevenue)}`, 14, 65);
  doc.text(`Profit/loss: ${mad(summary.totalProfitLoss)}`, 14, 72);
  doc.text(`Duplicates: ${summary.duplicateRows}`, 14, 79);
  doc.text(`Unmatched: ${summary.unmatchedRows}`, 14, 86);

  doc.setFontSize(12);
  doc.text("Top cost sites", 14, 100);
  Object.entries(summary.bySite).slice(0, 10).forEach(([site, amount], index) => {
    doc.text(`${site}: ${mad(amount)}`, 14, 110 + index * 7);
  });

  const flagStart = 184;
  doc.text("Red flags", 14, flagStart);
  summary.redFlags.slice(0, 8).forEach(([flag, count], index) => {
    doc.text(`${flag}: ${count}`, 14, flagStart + 10 + index * 7);
  });

  return new Response(Buffer.from(doc.output("arraybuffer")), {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `attachment; filename=scadacom-excel-cost-analysis-${excelImport.id}.pdf`
    }
  });
}

function addBreakdownSheet(workbook: ExcelJS.Workbook, name: string, data: Record<string, number>) {
  const sheet = workbook.addWorksheet(name);
  sheet.columns = [
    { header: "Label", key: "label", width: 40 },
    { header: "Amount / Count", key: "amount", width: 18 }
  ];
  Object.entries(data)
    .sort((a, b) => Number(b[1]) - Number(a[1]))
    .forEach(([label, amount]) => sheet.addRow({ label, amount }));
}

function addFilteredRowsSheet(workbook: ExcelJS.Workbook, name: string, rows: Array<{ sheetName: string; rowNumber: number; siteId: string | null; projectName: string | null; totalCost: unknown; revenue: unknown; profitLoss: unknown; profitabilityStatus: string; status: string; warnings: unknown }>) {
  const sheet = workbook.addWorksheet(name);
  sheet.columns = [
    { header: "Sheet", key: "sheetName", width: 24 },
    { header: "Row", key: "rowNumber", width: 8 },
    { header: "Site ID", key: "siteId", width: 18 },
    { header: "Project", key: "projectName", width: 32 },
    { header: "Cost", key: "totalCost", width: 16 },
    { header: "Revenue", key: "revenue", width: 16 },
    { header: "Profit/loss", key: "profitLoss", width: 16 },
    { header: "Profitability", key: "profitabilityStatus", width: 18 },
    { header: "Status", key: "status", width: 16 },
    { header: "Flags", key: "flags", width: 52 }
  ];
  rows.forEach((row) => sheet.addRow({
    sheetName: row.sheetName,
    rowNumber: row.rowNumber,
    siteId: row.siteId ?? "",
    projectName: row.projectName ?? "",
      totalCost: Number(row.totalCost ?? 0),
      revenue: row.revenue == null ? "" : Number(row.revenue),
      profitLoss: row.profitLoss == null ? "" : Number(row.profitLoss),
      profitabilityStatus: row.profitabilityStatus,
      status: row.status,
      flags: Array.isArray(row.warnings) ? row.warnings.join(", ") : ""
  }));
}

function buildSummary(rows: Array<{ totalCost: unknown; revenue: unknown; profitLoss: unknown; status: string; siteId: string | null; projectName: string | null; matchedProject?: { name: string } | null; warnings: unknown; fuelCost: unknown; highwayCost: unknown; salaryAllocatedCost: unknown; dailyAllowanceCost: unknown; purchaseCost: unknown; materialCost: unknown; toolCost: unknown; vehicleCost: unknown; paperPrintingCost: unknown; otherCost: unknown; unknownCost: unknown }>) {
  const usable = rows.filter((row) => row.status !== "DUPLICATE" && Number(row.totalCost ?? 0) > 0);
  return {
    totalCost: usable.reduce((sum, row) => sum + Number(row.totalCost ?? 0), 0),
    totalRevenue: usable.reduce((sum, row) => sum + Number(row.revenue ?? 0), 0),
    totalProfitLoss: usable.reduce((sum, row) => sum + Number(row.profitLoss ?? 0), 0),
    duplicateRows: rows.filter((row) => row.status === "DUPLICATE").length,
    unmatchedRows: rows.filter((row) => row.status === "UNMATCHED").length,
    bySite: totalMap(usable, (row) => row.siteId ?? "Missing site"),
    byProject: totalMap(usable, (row) => row.matchedProject?.name ?? row.projectName ?? "Unmatched"),
    byCategory: costCategoryMap(usable),
    revenueBySite: revenueMap(usable, (row) => row.siteId ?? "Missing site"),
    redFlags: Object.entries(rows.reduce<Record<string, number>>((flags, row) => {
      const rowFlags = Array.isArray(row.warnings) ? row.warnings.map(String) : [];
      rowFlags.forEach((flag) => { flags[flag] = (flags[flag] ?? 0) + 1; });
      return flags;
    }, {})).sort((a, b) => b[1] - a[1])
  };
}

function totalMap<T extends { totalCost: unknown }>(rows: T[], labelFor: (row: T) => string) {
  return rows.reduce<Record<string, number>>((totals, row) => {
    const label = labelFor(row) || "Missing";
    totals[label] = Math.round(((totals[label] ?? 0) + Number(row.totalCost ?? 0)) * 100) / 100;
    return totals;
  }, {});
}

async function getImportTypeHelper() {
  return prisma.excelImport.findFirst({
    include: {
      uploadedBy: { select: { name: true } },
      siteRows: { include: { matchedProject: { select: { name: true, siteId: true } } } },
      sheets: true
    }
  });
}

function revenueMap<T extends { revenue: unknown }>(rows: T[], labelFor: (row: T) => string) {
  return rows.reduce<Record<string, number>>((totals, row) => {
    const label = labelFor(row) || "Missing";
    totals[label] = Math.round(((totals[label] ?? 0) + Number(row.revenue ?? 0)) * 100) / 100;
    return totals;
  }, {});
}

function costCategoryMap(rows: Array<{ fuelCost: unknown; highwayCost: unknown; salaryAllocatedCost: unknown; dailyAllowanceCost: unknown; purchaseCost: unknown; materialCost: unknown; toolCost: unknown; vehicleCost: unknown; paperPrintingCost: unknown; otherCost: unknown; unknownCost: unknown }>) {
  return rows.reduce<Record<string, number>>((totals, row) => {
    const pairs: Array<[string, unknown]> = [
      ["Fuel", row.fuelCost],
      ["Highway", row.highwayCost],
      ["Salary", row.salaryAllocatedCost],
      ["Daily allowance", row.dailyAllowanceCost],
      ["Purchases", row.purchaseCost],
      ["Materials", row.materialCost],
      ["Tools", row.toolCost],
      ["Vehicle", row.vehicleCost],
      ["Paper/printing", row.paperPrintingCost],
      ["Other", row.otherCost],
      ["Unknown", row.unknownCost]
    ];
    pairs.forEach(([label, value]) => {
      totals[label] = Math.round(((totals[label] ?? 0) + Number(value ?? 0)) * 100) / 100;
    });
    return totals;
  }, {});
}
