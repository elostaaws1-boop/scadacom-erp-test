import ExcelJS from "exceljs";
import jsPDF from "jspdf";
import { NextRequest } from "next/server";
import { auth } from "@/auth";
import { projectScopeWhere } from "@/lib/access";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user) return new Response("Unauthorized", { status: 401 });
  const format = request.nextUrl.searchParams.get("format") ?? "xlsx";
  const projects = await prisma.project.findMany({ where: await projectScopeWhere(session.user), orderBy: { name: "asc" } });

  if (format === "pdf") {
    const doc = new jsPDF();
    doc.text("FieldOps ERP Report", 14, 18);
    projects.slice(0, 32).forEach((project, index) => {
      const y = 30 + index * 7;
      doc.text(`${project.name} | ${project.status} | Cost ${project.actualCost} MAD`, 14, y);
    });
    return new Response(Buffer.from(doc.output("arraybuffer")), {
      headers: { "content-type": "application/pdf", "content-disposition": "attachment; filename=fieldops-report.pdf" }
    });
  }

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Projects");
  sheet.columns = [
    { header: "Project", key: "name", width: 28 },
    { header: "Client", key: "client", width: 18 },
    { header: "Work Type", key: "workType", width: 18 },
    { header: "Technology", key: "technology", width: 18 },
    { header: "Contract Value", key: "contractValue", width: 18 },
    { header: "Actual Cost", key: "actualCost", width: 18 },
    { header: "Remaining Budget", key: "remaining", width: 18 }
  ];
  projects.forEach((project) => sheet.addRow({
    name: project.name,
    client: project.client,
    workType: project.workType,
    technology: project.technology,
    contractValue: Number(project.contractValue),
    actualCost: Number(project.actualCost),
    remaining: Number(project.allocatedBudget) - Number(project.actualCost)
  }));
  const buffer = await workbook.xlsx.writeBuffer();
  return new Response(buffer, {
    headers: { "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "content-disposition": "attachment; filename=fieldops-report.xlsx" }
  });
}
