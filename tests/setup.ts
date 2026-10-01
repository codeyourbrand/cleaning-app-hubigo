import { beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/prisma";

beforeAll(async () => {
  // Clean tables that are safe to truncate for tests
  const tables = [
    "audit_logs",
    "media",
    "comments",
    "task_steps",
    "tasks",
    "lost_found",
    "damages",
    "hostfully_reservations",
    "sync_events",
    "apartments",
    "users",
  ];
  for (const table of tables) {
    await prisma.$executeRawUnsafe(`TRUNCATE TABLE "${table}" CASCADE;`);
  }
});

afterAll(async () => {
  await prisma.$disconnect();
});
