import { describe, it, expect } from "vitest";
import { prisma } from "@/lib/prisma";
import { v4 as uuidv4 } from "uuid";
import { Role, TaskStatus } from "@prisma/client";
import { hashPassword } from "@/lib/password";

describe("Hostfully idempotency", () => {
  it("stores external reservation id and avoids duplicate tasks", async () => {
    const user = await prisma.user.create({
      data: {
        name: "Test",
        email: "hostfully-test@hubigo.local",
        role: Role.COORDINATOR,
        passwordHash: await hashPassword("pass"),
      },
    });

    const apartment = await prisma.apartment.create({
      data: { number: "H1", building: "Hostfully" },
    });

    const externalId = `ext-${uuidv4()}`;
    await prisma.hostfullyReservation.create({
      data: {
        externalId,
        apartmentId: apartment.id,
        rawPayload: {},
        status: "BOOKED",
      },
    });

    await prisma.task.create({
      data: {
        apartmentId: apartment.id,
        date: new Date("2026-10-05T00:00:00.000Z"),
        type: "CLEANING",
        status: TaskStatus.TODO,
        createdByUserId: user.id,
        externalHostfullyReservationId: externalId,
      },
    });

    const count = await prisma.task.count({
      where: { externalHostfullyReservationId: externalId },
    });
    expect(count).toBe(1);
  });
});
