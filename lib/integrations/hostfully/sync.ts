import { prisma } from "@/lib/prisma";
import {
  HostfullyLead,
  HostfullyProperty,
  HOSTFULLY_WEBHOOK_EVENT_TYPES,
  getProperties,
  getProperty,
  getLeads,
  getLead,
  listWebhooks,
  createWebhook,
} from "./client";
import { logAudit } from "@/lib/audit";
import { Prisma, Role, TaskType, TaskStatus } from "@prisma/client";
import { differenceInCalendarDays } from "date-fns";

export const ACTIVE_STATUSES = new Set([
  "BOOKED",
  "PAID_IN_FULL",
  "STAY",
  "ARCHIVED",
]);

export const CANCELLED_STATUSES = new Set([
  "CANCELLED",
  "CANCELLED_BY_TRAVELER",
  "CANCELLED_BY_OWNER",
  "DECLINED",
  "IGNORED",
  "HOLD_EXPIRED",
  "LEAD_SOFT_DELETED",
]);

export type LeadStatusClass = "active" | "cancelled" | "other";

export function classifyLeadStatus(lead: HostfullyLead): LeadStatusClass {
  const status = lead.status?.toUpperCase() ?? "";
  if (CANCELLED_STATUSES.has(status)) return "cancelled";
  if (lead.type === "BOOKING" && ACTIVE_STATUSES.has(status)) return "active";
  return "other";
}

/** "2026-10-18T11:00:00" -> { date: UTC midnight, time: "11:00" } */
function parseLocalDateTime(local?: string): {
  date: Date;
  time: string;
} | null {
  if (!local) return null;
  const [datePart, timePart] = local.split("T");
  const [y, m, d] = datePart.split("-").map(Number);
  if (!y || !m || !d) return null;
  return {
    date: new Date(Date.UTC(y, m - 1, d)),
    time: timePart ? timePart.slice(0, 5) : "00:00",
  };
}

function parseInstant(zoned?: string, local?: string): Date | null {
  const raw = zoned ?? local;
  if (!raw) return null;
  const parsed = new Date(raw);
  return isNaN(parsed.getTime()) ? null : parsed;
}

export function mapLeadToTaskData(lead: HostfullyLead) {
  const checkIn = parseLocalDateTime(lead.checkInLocalDateTime);
  const checkOut = parseLocalDateTime(lead.checkOutLocalDateTime);
  const guest = lead.guestInformation;

  return {
    cleaningDate: checkOut?.date ?? null,
    checkoutTime: checkOut?.time ?? null,
    checkinWindow: checkIn?.time ?? null,
    guestsCount:
      (guest?.adultCount ?? 0) +
        (guest?.childrenCount ?? 0) +
        (guest?.infantCount ?? 0) || null,
    nightsCount:
      checkIn && checkOut
        ? differenceInCalendarDays(checkOut.date, checkIn.date)
        : null,
    requests: lead.extraNotes ?? null,
    instructions: lead.notes ?? null,
    checkInInstant: parseInstant(
      lead.checkInZonedDateTime,
      lead.checkInLocalDateTime,
    ),
    checkOutInstant: parseInstant(
      lead.checkOutZonedDateTime,
      lead.checkOutLocalDateTime,
    ),
  };
}

export function mapPropertyToApartment(property: HostfullyProperty) {
  return {
    number: property.name?.trim() || property.uid,
    building: property.address?.city?.trim() || null,
    floor: null,
  };
}

/**
 * Match strictly by externalHostfullyId — property names are not unique.
 * Creates only for active properties; on (number, building) unique
 * collision retries once with a uid suffix.
 */
async function findOrCreateApartment(property: HostfullyProperty) {
  const existing = await prisma.apartment.findUnique({
    where: { externalHostfullyId: property.uid },
  });
  const mapped = mapPropertyToApartment(property);
  if (existing) {
    return prisma.apartment.update({
      where: { id: existing.id },
      data: mapped,
    });
  }
  if (property.isActive === false) return null;
  try {
    return await prisma.apartment.create({
      data: { ...mapped, externalHostfullyId: property.uid },
    });
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      return prisma.apartment.create({
        data: {
          ...mapped,
          number: `${mapped.number} (${property.uid.slice(0, 6)})`,
          externalHostfullyId: property.uid,
        },
      });
    }
    throw err;
  }
}

interface SyncContext {
  propertyCache: Map<string, HostfullyProperty | null>;
  coordinatorId: string;
}

async function fetchAndCacheProperty(
  ctx: SyncContext,
  uid: string,
): Promise<HostfullyProperty | null> {
  if (ctx.propertyCache.has(uid)) return ctx.propertyCache.get(uid) ?? null;
  const property = await getProperty(uid);
  ctx.propertyCache.set(uid, property);
  return property;
}

async function deleteTaskIfTodo(
  ctx: SyncContext,
  taskId: string,
  leadUid: string,
): Promise<boolean> {
  const task = await prisma.task.findUnique({ where: { id: taskId } });
  if (!task) return false;
  if (task.status !== TaskStatus.TODO) return false;
  await prisma.task.delete({ where: { id: task.id } });
  await logAudit({
    userId: ctx.coordinatorId,
    action: "HOSTFULLY_SYNC",
    newValue: {
      taskId: task.id,
      leadUid,
      reason: "booking cancelled, TODO task removed",
    },
  });
  return true;
}

async function processReservation(lead: HostfullyLead, ctx: SyncContext) {
  const mapped = mapLeadToTaskData(lead);
  const statusClass = classifyLeadStatus(lead);

  const reservationData = {
    rawPayload: lead as unknown as Prisma.InputJsonValue,
    status: lead.status ?? "UNKNOWN",
    checkIn: mapped.checkInInstant,
    checkOut: mapped.checkOutInstant,
    guestsCount: mapped.guestsCount,
    nightsCount: mapped.nightsCount,
    lastSyncedAt: new Date(),
  };

  const reservation = await prisma.hostfullyReservation.upsert({
    where: { externalId: lead.uid },
    create: { externalId: lead.uid, ...reservationData },
    update: reservationData,
  });

  const linkedTask = await prisma.task.findUnique({
    where: { externalHostfullyReservationId: lead.uid },
  });

  if (statusClass === "cancelled") {
    if (linkedTask && (await deleteTaskIfTodo(ctx, linkedTask.id, lead.uid))) {
      return {
        reservation,
        task: null,
        created: false,
        cancelled: true,
        skipped: null,
      };
    }
    return {
      reservation,
      task: linkedTask,
      created: false,
      cancelled: false,
      skipped: linkedTask
        ? "Cancelled booking, task already in progress/done"
        : "Cancelled booking, no task",
    };
  }

  if (statusClass !== "active") {
    return {
      reservation,
      task: null,
      created: false,
      cancelled: false,
      skipped: `Status ${lead.status ?? "?"} / type ${lead.type ?? "?"}`,
    };
  }

  if (!lead.propertyUid) {
    return {
      reservation,
      task: null,
      created: false,
      cancelled: false,
      skipped: "No propertyUid",
    };
  }

  const property = await fetchAndCacheProperty(ctx, lead.propertyUid);
  if (!property) {
    return {
      reservation,
      task: null,
      created: false,
      cancelled: false,
      skipped: "Property not found",
    };
  }

  const apartment = await findOrCreateApartment(property);
  if (!apartment) {
    return {
      reservation,
      task: null,
      created: false,
      cancelled: false,
      skipped: "Property inactive",
    };
  }
  await prisma.hostfullyReservation.update({
    where: { id: reservation.id },
    data: { apartmentId: apartment.id },
  });

  if (!mapped.cleaningDate) {
    return {
      reservation,
      task: null,
      created: false,
      cancelled: false,
      skipped: "No checkout date",
    };
  }

  const todayUtc = new Date(
    Date.UTC(
      new Date().getUTCFullYear(),
      new Date().getUTCMonth(),
      new Date().getUTCDate(),
    ),
  );
  const isPastCheckout = mapped.cleaningDate < todayUtc;

  const taskPayload = {
    apartmentId: apartment.id,
    date: mapped.cleaningDate,
    type: TaskType.CLEANING,
    status: TaskStatus.TODO,
    checkoutTime: mapped.checkoutTime,
    checkinWindow: mapped.checkinWindow,
    guestsCount: mapped.guestsCount,
    nightsCount: mapped.nightsCount,
    requests: mapped.requests,
    instructions: mapped.instructions,
  };

  if (linkedTask) {
    // Keep whatever status the team already set; refresh the details only.
    const { status: _status, ...updatePayload } = taskPayload;
    const task = await prisma.task.update({
      where: { id: linkedTask.id },
      data: updatePayload,
    });
    return {
      reservation,
      task,
      created: false,
      cancelled: false,
      skipped: null,
    };
  }

  if (isPastCheckout) {
    return {
      reservation,
      task: null,
      created: false,
      cancelled: false,
      skipped: "Past checkout",
    };
  }

  // Idempotency fallback: adopt an unlinked task (e.g. CSV-imported) for
  // the same apartment + date.
  const duplicate = await prisma.task.findFirst({
    where: {
      apartmentId: apartment.id,
      date: mapped.cleaningDate,
      externalHostfullyReservationId: null,
    },
  });
  if (duplicate) {
    const task = await prisma.task.update({
      where: { id: duplicate.id },
      data: { ...taskPayload, externalHostfullyReservationId: lead.uid },
    });
    return {
      reservation,
      task,
      created: false,
      cancelled: false,
      skipped: null,
    };
  }

  const task = await prisma.task.create({
    data: {
      ...taskPayload,
      externalHostfullyReservationId: lead.uid,
      createdByUserId: ctx.coordinatorId,
    },
  });
  return { reservation, task, created: true, cancelled: false, skipped: null };
}

async function resolveCoordinatorId(): Promise<string> {
  const coordinator = await prisma.user.findFirst({
    where: { role: Role.COORDINATOR },
    orderBy: { createdAt: "asc" },
  });
  if (!coordinator) {
    throw new Error("No coordinator user exists to own Hostfully tasks");
  }
  return coordinator.id;
}

export async function syncHostfully(opts?: { since?: Date }) {
  const results = {
    properties: 0,
    reservations: 0,
    tasksCreated: 0,
    tasksUpdated: 0,
    tasksCancelled: 0,
    skipped: 0,
    errors: [] as { message: string; leadUid?: string }[],
  };

  const ctx: SyncContext = {
    propertyCache: new Map(),
    coordinatorId: await resolveCoordinatorId(),
  };

  try {
    const properties = await getProperties();
    for (const property of properties) {
      try {
        ctx.propertyCache.set(property.uid, property);
        if (await findOrCreateApartment(property)) results.properties++;
      } catch (err) {
        results.errors.push({
          message: `Property ${property.uid}: ${(err as Error).message}`,
        });
      }
    }
  } catch (err) {
    results.errors.push({
      message: `Properties fetch failed: ${(err as Error).message}`,
    });
  }

  try {
    const leads = await getLeads(opts?.since);
    for (const lead of leads) {
      try {
        const { task, created, cancelled, skipped } = await processReservation(
          lead,
          ctx,
        );
        results.reservations++;
        if (skipped) results.skipped++;
        else if (cancelled) results.tasksCancelled++;
        else if (task)
          created ? results.tasksCreated++ : results.tasksUpdated++;
      } catch (err) {
        results.errors.push({
          message: (err as Error).message,
          leadUid: lead.uid,
        });
      }
    }
  } catch (err) {
    results.errors.push({
      message: `Leads fetch failed: ${(err as Error).message}`,
    });
  }

  try {
    await logAudit({
      userId: ctx.coordinatorId,
      action: "HOSTFULLY_SYNC",
      newValue: results,
    });
  } catch {
    // ignore audit failure
  }

  return results;
}

export async function syncHostfullyLead(leadUid: string) {
  const ctx: SyncContext = {
    propertyCache: new Map(),
    coordinatorId: await resolveCoordinatorId(),
  };
  const lead = await getLead(leadUid);
  if (!lead) {
    // 404 from Hostfully => soft-deleted lead
    const reservation = await prisma.hostfullyReservation.findUnique({
      where: { externalId: leadUid },
    });
    if (reservation) {
      await prisma.hostfullyReservation.update({
        where: { id: reservation.id },
        data: { status: "DELETED", lastSyncedAt: new Date() },
      });
    }
    const task = await prisma.task.findUnique({
      where: { externalHostfullyReservationId: leadUid },
    });
    if (task) await deleteTaskIfTodo(ctx, task.id, leadUid);
    return { reservation, task: null, deleted: true };
  }
  return processReservation(lead, ctx);
}

export async function syncHostfullyProperty(propertyUid: string) {
  const property = await getProperty(propertyUid);
  if (!property) return null;
  return findOrCreateApartment(property);
}

export async function registerHostfullyWebhooks(callbackUrl: string) {
  const existing = await listWebhooks();
  const present = new Set(
    existing
      .filter((w) => w.callbackUrl === callbackUrl)
      .map((w) => w.eventType),
  );
  const created: string[] = [];
  const already: string[] = [];
  for (const eventType of HOSTFULLY_WEBHOOK_EVENT_TYPES) {
    if (present.has(eventType)) {
      already.push(eventType);
      continue;
    }
    await createWebhook({ eventType, callbackUrl });
    created.push(eventType);
  }
  return { created, existing: already };
}
