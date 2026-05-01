import bcrypt from "bcryptjs";
import { prisma } from "../lib/prisma";

async function main() {
  const email = (process.env.BOSS_EMAIL ?? "boss@telecom.local").toLowerCase();
  const user = await prisma.user.findUnique({ where: { email } });
  const passwordOk = user ? await bcrypt.compare("ChangeMe123!", user.passwordHash) : false;

  if (!user || user.role !== "BOSS" || !passwordOk) {
    throw new Error(`Boss login seed verification failed for ${email}. user=${!!user} role=${user?.role ?? "none"} passwordOk=${passwordOk}`);
  }

  console.log(`Boss login seed verified for ${email}.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
