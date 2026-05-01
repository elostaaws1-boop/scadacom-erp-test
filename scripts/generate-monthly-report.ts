import { generateMonthlyPerformanceReport, previousMonth } from "../lib/monthly-report";
import { prisma } from "../lib/prisma";

async function main() {
  const now = new Date();
  const explicitMonth = process.argv[2] ? Number(process.argv[2]) : undefined;
  const explicitYear = process.argv[3] ? Number(process.argv[3]) : undefined;
  const period = explicitMonth && explicitYear ? { month: explicitMonth, year: explicitYear } : previousMonth(now.getMonth() + 1, now.getFullYear());
  const boss = await prisma.user.findFirst({ where: { role: "BOSS", active: true }, orderBy: { createdAt: "asc" } });

  if (!boss) {
    throw new Error("No active Boss user found for monthly report generation.");
  }

  const report = await generateMonthlyPerformanceReport(period.month, period.year, boss.id);
  await prisma.auditLog.create({
    data: {
      actorId: boss.id,
      action: "AUTO_GENERATE_MONTHLY_REPORT",
      entity: "MonthlyPerformanceReport",
      entityId: report.id,
      after: { month: period.month, year: period.year, status: report.status }
    }
  });

  console.log(`Generated monthly report ${period.month}/${period.year}: ${report.id}`);
}

main()
  .finally(async () => {
    await prisma.$disconnect();
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
