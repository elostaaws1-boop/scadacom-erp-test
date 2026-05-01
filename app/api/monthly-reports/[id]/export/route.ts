import ExcelJS from "exceljs";
import jsPDF from "jspdf";
import { NextRequest } from "next/server";
import { auth } from "@/auth";
import { audit } from "@/lib/audit";
import type { MonthlyReportSnapshot } from "@/lib/monthly-report";
import { prisma } from "@/lib/prisma";
import { isBossIdentity } from "@/lib/rbac";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user || !isBossIdentity(session.user.role, session.user.email)) return new Response("Unauthorized", { status: 401 });
  const { id } = await params;
  const report = await prisma.monthlyPerformanceReport.findUnique({ where: { id } });
  if (!report) return new Response("Not found", { status: 404 });

  const format = request.nextUrl.searchParams.get("format") ?? "pdf";
  const snapshot = report.snapshot as MonthlyReportSnapshot;
  await audit({ actorId: session.user.id, action: `EXPORT_MONTHLY_REPORT_${format.toUpperCase()}`, entity: "MonthlyPerformanceReport", entityId: report.id, after: { month: report.month, year: report.year, format } });

  if (format === "xlsx") {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = "ScadaCom ERP";
    workbook.created = new Date();
    addKeyValueSheet(workbook, "Financial", snapshot.financial);
    addKeyValueSheet(workbook, "Comparison", snapshot.comparison);
    addRowsSheet(workbook, "Expense Categories", snapshot.expenseAnalysis.byCategory);
    addRowsSheet(workbook, "Top Cost Projects", snapshot.expenseAnalysis.topCostProjects);
    addRowsSheet(workbook, "Team Efficiency", snapshot.operational.teamEfficiency);
    addRowsSheet(workbook, "Supplier Overdue", snapshot.supplierTax.supplierOverdueList);
    addRowsSheet(workbook, "Taxes Overdue", snapshot.supplierTax.taxesOverdue);
    addRowsSheet(workbook, "Fleet", snapshot.fleet.fuelConsumptionPerVehicle);
    addRowsSheet(workbook, "Warehouse", snapshot.warehouse.mostUsedItems);
    addRowsSheet(workbook, "Insights", snapshot.insights);
    const buffer = await workbook.xlsx.writeBuffer();
    return new Response(buffer, {
      headers: {
        "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "content-disposition": `attachment; filename=scadacom-monthly-report-${report.year}-${String(report.month).padStart(2, "0")}.xlsx`
      }
    });
  }

  const doc = new jsPDF();
  let y = 18;
  doc.setFontSize(16);
  doc.text(`ScadaCom Monthly Performance Report - ${snapshot.period.label}`, 14, y);
  y += 10;
  doc.setFontSize(11);
  y = addPdfSection(doc, y, "Financial Summary", [
    ["Total revenue", money(snapshot.financial.totalRevenue)],
    ["Total expenses", money(snapshot.financial.totalExpenses)],
    ["Total profit/loss", money(snapshot.financial.totalProfit)],
    ["Profit margin", `${snapshot.financial.profitMargin}%`],
    ["Cash inflow", money(snapshot.financial.cashInflow)],
    ["Cash outflow", money(snapshot.financial.cashOutflow)],
    ["Outstanding supplier debt", money(snapshot.financial.outstandingSupplierDebt)],
    ["Outstanding taxes", money(snapshot.financial.outstandingTaxes)]
  ]);
  y = addPdfSection(doc, y, "Project Performance", [
    ["Active projects", snapshot.projectPerformance.totalActiveProjects],
    ["Completed projects", snapshot.projectPerformance.completedProjects],
    ["Most profitable", snapshot.projectPerformance.mostProfitableProject ?? "-"],
    ["Least profitable", snapshot.projectPerformance.leastProfitableProject ?? "-"],
    ["Average margin", `${snapshot.projectPerformance.averageProjectMargin}%`]
  ]);
  y = addPdfSection(doc, y, "Operational Performance", [
    ["Total missions", snapshot.operational.totalMissions],
    ["Completed missions", snapshot.operational.completedMissions],
    ["Delayed missions", snapshot.operational.delayedMissions],
    ["Average duration", snapshot.operational.averageMissionDuration]
  ]);
  y = addPdfSection(doc, y, "Forecast", [
    ["Expected next month profit", money(snapshot.forecast.expectedNextMonthProfit)],
    ["Risk level", snapshot.forecast.riskLevel],
    ["Cash stability", snapshot.forecast.cashStabilityForecast]
  ]);
  y = addPdfSection(doc, y, "Smart Insights", snapshot.insights.slice(0, 8).map((insight) => [insight.title, `${insight.impact}: ${insight.description}`]));

  return new Response(Buffer.from(doc.output("arraybuffer")), {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `attachment; filename=scadacom-monthly-report-${report.year}-${String(report.month).padStart(2, "0")}.pdf`
    }
  });
}

function addKeyValueSheet(workbook: ExcelJS.Workbook, name: string, values: Record<string, number>) {
  const sheet = workbook.addWorksheet(name);
  sheet.columns = [{ header: "Metric", key: "metric", width: 32 }, { header: "Value", key: "value", width: 18 }];
  Object.entries(values).forEach(([metric, value]) => sheet.addRow({ metric, value }));
}

function addRowsSheet(workbook: ExcelJS.Workbook, name: string, rows: Array<Record<string, unknown>>) {
  const sheet = workbook.addWorksheet(name);
  const keys = Array.from(new Set(rows.flatMap((row) => Object.keys(row))));
  sheet.columns = keys.map((key) => ({ header: key, key, width: 24 }));
  rows.forEach((row) => sheet.addRow(row));
}

function addPdfSection(doc: jsPDF, y: number, title: string, rows: Array<[string, string | number]>) {
  if (y > 250) {
    doc.addPage();
    y = 18;
  }
  doc.setFontSize(13);
  doc.text(title, 14, y);
  y += 7;
  doc.setFontSize(10);
  for (const [label, value] of rows) {
    if (y > 280) {
      doc.addPage();
      y = 18;
    }
    const text = `${label}: ${String(value)}`;
    doc.text(doc.splitTextToSize(text, 180), 14, y);
    y += 7;
  }
  return y + 4;
}

function money(value: number) {
  return `${Number(value || 0).toLocaleString("fr-MA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} MAD`;
}
