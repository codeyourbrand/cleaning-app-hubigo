import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { Role, TaskType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/password";

vi.mock("@/lib/auth", () => ({
  verifySession: vi.fn(),
}));

import { verifySession } from "@/lib/auth";
import { POST } from "@/app/api/tasks/[id]/whatsapp/route";

const whapi = vi.fn();

async function seed({ phone }: { phone: string | null }) {
  const coordinator = await prisma.user.create({
    data: {
      name: "Kinga",
      email: "kinga@hubigo.local",
      role: Role.COORDINATOR,
      passwordHash: await hashPassword("pass"),
    },
  });
  const cleaner = await prisma.user.create({
    data: {
      name: "Anna",
      email: "anna@hubigo.local",
      phone,
      role: Role.CLEANER,
      passwordHash: await hashPassword("pass"),
    },
  });
  const apartment = await prisma.apartment.create({
    data: { number: "5805", building: "Tower" },
  });
  const task = await prisma.task.create({
    data: {
      apartmentId: apartment.id,
      date: new Date("2026-10-10T00:00:00.000Z"),
      type: TaskType.CHECK_OUT,
      checkoutTime: "11:00",
      createdByUserId: coordinator.id,
      assignedToUserId: cleaner.id,
    },
  });
  vi.mocked(verifySession).mockResolvedValue({
    userId: coordinator.id,
    role: Role.COORDINATOR,
    name: coordinator.name,
  });
  return { coordinator, cleaner, task };
}

function send(taskId: string, query = "") {
  return POST(
    new NextRequest(`http://localhost/api/tasks/${taskId}/whatsapp${query}`, {
      method: "POST",
    }),
    { params: Promise.resolve({ id: taskId }) },
  );
}

beforeEach(async () => {
  await prisma.auditLog.deleteMany();
  await prisma.task.deleteMany();
  await prisma.apartment.deleteMany();
  await prisma.user.deleteMany();
  process.env.WHAPI_TOKEN = "test-token";
  whapi.mockReset().mockResolvedValue(new Response("{}", { status: 200 }));
  vi.stubGlobal("fetch", whapi);
  for (const eventType of ["TASK_ASSIGNED", "TASK_TIMING_CHANGED"]) {
    await prisma.whatsAppNotificationSetting.upsert({
      where: { eventType },
      create: { eventType, enabled: true, destination: "USER" },
      update: { enabled: true, destination: "USER" },
    });
  }
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("POST /api/tasks/:id/whatsapp", () => {
  it("refuses a task with nobody assigned", async () => {
    const { task } = await seed({ phone: "+971 58 590 1656" });
    await prisma.task.update({
      where: { id: task.id },
      data: { assignedToUserId: null },
    });

    const res = await send(task.id);

    expect(res.status).toBe(409);
    expect(whapi).not.toHaveBeenCalled();
  });

  it("refuses when the cleaner has no phone number", async () => {
    const { task } = await seed({ phone: null });

    const res = await send(task.id);

    expect(res.status).toBe(422);
    expect(whapi).not.toHaveBeenCalled();
  });

  it("sends the assignment once, to the cleaner's own number", async () => {
    const { task, cleaner } = await seed({ phone: "+971 58 590 1656" });

    const first = await send(task.id);
    expect(await first.json()).toEqual({ kind: "ASSIGNED" });
    expect(whapi).toHaveBeenCalledTimes(1);
    const sent = JSON.parse(whapi.mock.calls[0][1].body);
    expect(sent.to).toBe("971585901656@s.whatsapp.net");
    expect(sent.body).toContain("*Anna* assigned to:");

    const saved = await prisma.task.findUnique({ where: { id: task.id } });
    expect(saved?.whatsappSentToUserId).toBe(cleaner.id);
    expect(saved?.whatsappSentCheckoutTime).toBe("11:00");

    const second = await send(task.id);
    expect(await second.json()).toEqual({ kind: "UP_TO_DATE" });
    expect(whapi).toHaveBeenCalledTimes(1);
  });

  it("sends TIMING CHANGED when the time is edited after sending", async () => {
    const { task } = await seed({ phone: "+971 58 590 1656" });
    await send(task.id);
    whapi.mockClear();

    await prisma.task.update({
      where: { id: task.id },
      data: { checkoutTime: "12:30" },
    });
    const res = await send(task.id);

    expect(await res.json()).toEqual({ kind: "TIMING_CHANGED" });
    const sent = JSON.parse(whapi.mock.calls[0][1].body);
    expect(sent.body).toContain("TIMING CHANGED");
    expect(sent.body).toContain("Checkout: ~11:00~ → *12:30*");

    const saved = await prisma.task.findUnique({ where: { id: task.id } });
    expect(saved?.whatsappSentCheckoutTime).toBe("12:30");
  });

  it("resends the assignment on request", async () => {
    const { task } = await seed({ phone: "+971 58 590 1656" });
    await send(task.id);
    whapi.mockClear();

    const res = await send(task.id, "?resend=true");

    expect(await res.json()).toEqual({ kind: "ASSIGNED" });
    expect(whapi).toHaveBeenCalledTimes(1);
  });

  it("does not record the message as sent when WhatsApp fails", async () => {
    const { task } = await seed({ phone: "+971 58 590 1656" });
    whapi.mockResolvedValue(new Response("boom", { status: 500 }));

    const res = await send(task.id);

    expect(res.status).toBe(502);
    const saved = await prisma.task.findUnique({ where: { id: task.id } });
    expect(saved?.whatsappSentAt).toBeNull();
  });
});
