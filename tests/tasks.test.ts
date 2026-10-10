import { describe, it, expect } from "vitest";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/password";
import { Role, TaskStatus, TaskType } from "@prisma/client";

describe("tasks", () => {
  it("creates and starts a task", async () => {
    const user = await prisma.user.create({
      data: {
        name: "Cleaner A",
        email: "cleaner-a@hubigo.local",
        role: Role.CLEANER,
        passwordHash: await hashPassword("pass"),
      },
    });

    const apartment = await prisma.apartment.create({
      data: { number: "100", building: "Tower", floor: "5" },
    });

    const task = await prisma.task.create({
      data: {
        apartmentId: apartment.id,
        date: new Date("2026-10-01T00:00:00.000Z"),
        type: TaskType.CLEANING,
        status: TaskStatus.TODO,
        createdByUserId: user.id,
        assignedTo: { create: { userId: user.id } },
        steps: { create: [{ name: "Kitchen", order: 0 }] },
      },
      include: { steps: true },
    });

    expect(task.status).toBe(TaskStatus.TODO);
    expect(task.steps.length).toBe(1);

    await prisma.task.update({
      where: { id: task.id },
      data: {
        status: TaskStatus.IN_PROGRESS,
        startedAt: new Date(),
        startedByUserId: user.id,
      },
    });

    const updated = await prisma.task.findUnique({ where: { id: task.id } });
    expect(updated?.status).toBe(TaskStatus.IN_PROGRESS);
    expect(updated?.startedByUserId).toBe(user.id);
  });
});
