import { PrismaClient, Role } from "@prisma/client";
import { hashPassword } from "../lib/password";

const { ADMIN_NAME, ADMIN_EMAIL, ADMIN_PASSWORD } = process.env;

if (!ADMIN_NAME || !ADMIN_EMAIL || !ADMIN_PASSWORD) {
  console.error(
    "ADMIN_NAME, ADMIN_EMAIL and ADMIN_PASSWORD must all be set.",
  );
  process.exit(1);
}

if (ADMIN_PASSWORD.length < 10) {
  console.error("ADMIN_PASSWORD must be at least 10 characters.");
  process.exit(1);
}

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await hashPassword(ADMIN_PASSWORD!);
  await prisma.user.upsert({
    where: { email: ADMIN_EMAIL! },
    update: {
      name: ADMIN_NAME!,
      role: Role.COORDINATOR,
      passwordHash,
      active: true,
    },
    create: {
      name: ADMIN_NAME!,
      email: ADMIN_EMAIL!,
      role: Role.COORDINATOR,
      passwordHash,
      active: true,
    },
  });
  console.log(`Admin ready: ${ADMIN_EMAIL}`);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
