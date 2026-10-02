import { describe, it, expect, vi, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { v4 as uuidv4 } from "uuid";
import { Role, TaskStatus } from "@prisma/client";
import { hashPassword } from "@/lib/password";
import {
  classifyLeadStatus,
  mapLeadToTaskData,
  mapPropertyToApartment,
  syncHostfully,
} from "@/lib/integrations/hostfully/sync";
import type {
  HostfullyLead,
  HostfullyProperty,
} from "@/lib/integrations/hostfully/client";

const mockState = vi.hoisted(() => ({
  properties: [] as HostfullyProperty[],
  leads: [] as HostfullyLead[],
}));

vi.mock("@/lib/integrations/hostfully/client", async (importOriginal) => {
  const original =
    await importOriginal<
      typeof import("@/lib/integrations/hostfully/client")
    >();
  return {
    ...original,
    getProperties: vi.fn(async () => mockState.properties),
    getLeads: vi.fn(async () => mockState.leads),
    getProperty: vi.fn(
      async (uid: string) =>
        mockState.properties.find((p) => p.uid === uid) ?? null,
    ),
    getLead: vi.fn(
      async (uid: string) => mockState.leads.find((l) => l.uid === uid) ?? null,
    ),
  };
});

function makeLead(overrides: Partial<HostfullyLead>): HostfullyLead {
  return {
    uid: uuidv4(),
    type: "BOOKING",
    status: "BOOKED",
    ...overrides,
  };
}

function futureLocal(daysOut: number, time: string): string {
  const d = new Date(Date.now() + daysOut * 86400000);
  return `${d.toISOString().slice(0, 10)}T${time}:00`;
}

describe("Hostfully mapping", () => {
  it("maps lead dates/times/guests/nights", () => {
    const lead = makeLead({
      checkInLocalDateTime: "2026-10-15T15:00:00",
      checkOutLocalDateTime: "2026-10-18T11:00:00",
      guestInformation: { adultCount: 2, childrenCount: 0, infantCount: 0 },
      extraNotes: "wants early check-in",
      notes: "leave extra towels",
    });
    const mapped = mapLeadToTaskData(lead);
    expect(mapped.cleaningDate?.toISOString()).toBe("2026-10-18T00:00:00.000Z");
    expect(mapped.checkoutTime).toBe("11:00");
    expect(mapped.checkinWindow).toBe("15:00");
    expect(mapped.guestsCount).toBe(2);
    expect(mapped.nightsCount).toBe(3);
    expect(mapped.requests).toBe("wants early check-in");
    expect(mapped.instructions).toBe("leave extra towels");
  });

  it("classifies lead statuses", () => {
    expect(classifyLeadStatus(makeLead({ status: "BOOKED" }))).toBe("active");
    expect(
      classifyLeadStatus(makeLead({ status: "CANCELLED_BY_TRAVELER" })),
    ).toBe("cancelled");
    expect(classifyLeadStatus(makeLead({ status: "ON_HOLD" }))).toBe("other");
  });

  it("maps property to apartment without leaking street into floor", () => {
    const property: HostfullyProperty = {
      uid: "prop-1",
      name: "  Princess 8404 - Bright spacious 1BDR  ",
      isActive: true,
      address: { address: "12 Marina Walk", city: " Dubai " },
    };
    const mapped = mapPropertyToApartment(property);
    expect(mapped.number).toBe("Princess 8404 - Bright spacious 1BDR");
    expect(mapped.building).toBe("Dubai");
    expect(mapped.floor).toBeNull();
  });
});

describe("Hostfully sync (mocked client, real DB)", () => {
  beforeEach(async () => {
    mockState.properties = [];
    mockState.leads = [];
    await prisma.user.create({
      data: {
        name: "Coordinator",
        email: `coord-${uuidv4()}@hubigo.local`,
        role: Role.COORDINATOR,
        passwordHash: await hashPassword("password123"),
      },
    });
  });

  it("is idempotent and deletes TODO tasks for cancelled bookings", async () => {
    const propertyUid = uuidv4();
    const leadUid = uuidv4();
    const cancelledUid = uuidv4();

    mockState.properties = [
      {
        uid: propertyUid,
        name: "Test Apartment 1",
        isActive: true,
        address: { city: "Dubai" },
      },
    ];
    const lead = makeLead({
      uid: leadUid,
      propertyUid,
      checkInLocalDateTime: futureLocal(28, "15:00"),
      checkOutLocalDateTime: futureLocal(30, "11:00"),
      guestInformation: { adultCount: 2 },
    });
    const cancelled = makeLead({
      uid: cancelledUid,
      propertyUid,
      status: "CANCELLED",
      checkInLocalDateTime: futureLocal(33, "15:00"),
      checkOutLocalDateTime: futureLocal(35, "11:00"),
    });
    mockState.leads = [lead, cancelled];

    await syncHostfully();
    let tasks = await prisma.task.findMany({
      where: { externalHostfullyReservationId: leadUid },
    });
    expect(tasks).toHaveLength(1);
    expect(tasks[0].status).toBe(TaskStatus.TODO);
    expect(
      await prisma.task.count({
        where: { externalHostfullyReservationId: cancelledUid },
      }),
    ).toBe(0);

    // Second run: still exactly one task for the booked lead.
    const second = await syncHostfully();
    expect(second.tasksCreated).toBe(0);
    tasks = await prisma.task.findMany({
      where: { externalHostfullyReservationId: leadUid },
    });
    expect(tasks).toHaveLength(1);

    // Flip the lead to CANCELLED: the TODO task must be deleted.
    mockState.leads = [{ ...lead, status: "CANCELLED" }, cancelled];
    const third = await syncHostfully();
    expect(
      await prisma.task.count({
        where: { externalHostfullyReservationId: leadUid },
      }),
    ).toBe(0);
    expect(third.tasksCancelled).toBe(1);
  });
});
