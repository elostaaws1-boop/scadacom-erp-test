const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();
const day = 86_400_000;

async function main() {
  await prisma.vehicle.upsert({
    where: { plate: "12345-A-6" },
    update: {},
    create: {
      id: "veh-1",
      plate: "12345-A-6",
      model: "Dacia Dokker",
      mileage: 84500,
      fuelUsage: 1200,
      locationType: "MANUAL",
      oilChangeDue: new Date(Date.now() + 20 * day),
      insuranceDue: new Date(Date.now() + 45 * day),
      inspectionDue: new Date(Date.now() + 10 * day)
    }
  });

  await prisma.vehicle.upsert({
    where: { plate: "67890-B-6" },
    update: {},
    create: {
      id: "veh-2",
      plate: "67890-B-6",
      model: "Renault Kangoo",
      mileage: 132000,
      fuelUsage: 2150,
      locationType: "GOOGLE_MAPS",
      oilChangeDue: new Date(Date.now() - 5 * day),
      insuranceDue: new Date(Date.now() + 90 * day),
      inspectionDue: new Date(Date.now() + 25 * day)
    }
  });
}

main()
  .then(() => console.log("fleet seed ok"))
  .finally(() => prisma.$disconnect());
