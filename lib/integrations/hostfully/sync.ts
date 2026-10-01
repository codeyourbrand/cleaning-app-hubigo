import { prisma } from "@/lib/prisma";
import {
  HostfullyLead,
  HostfullyProperty,
  getProperties,
  getLeads,
  getLead,
} from "./client";
import { logAudit } from "@/lib/audit";
import { TaskType, TaskStatus } from "@prisma/client";
import { differenceInCalendarDays, parseISO, format } from "date-fns";

/**
 * Normalize a Hostfully property into Hubigo apartment fields.
 */
function mapPropertyToApartment(property: HostfullyProperty) {
  return {
    externalHostfullyId: property.uid,
    number: property.internalName || property.name || property.uid,
    building: property.address?.city || "Hostfully",
    floor: property.address?.street,
    notes: property.description,
  };
}

async function findOrCreateApartment(property: HostfullyProperty) {
  const mapped = mapPropertyToApartment(property);
  let apartment = await prisma.apartment.findUnique({
    where: { externalHostfullyId: property.uid },
  });
  if (!apartment) {
    apartment = await prisma.apartment.findFirst({
      where: { number: mapped.number },
    });
  }
  if (!apartment) {
    apartment = await prisma.apartment.create({
      data: mapped,
    });
  } else {
    apartment = await prisma.apartment.update({
      where: { id: apartment.id },
      data: {
        externalHostfullyId: property.uid,
        number: mapped.number,
        building: mapped.building,
        floor: mapped.floor,
        notes: mapped.notes,
      },
    });
  }
  return apartment;
}

function parseDateTime(dateStr?: string, timeStr?: string): Date | null {
  if (!dateStr) return null;
  if (timeStr) {
    const iso = `${dateStr}T${timeStr}`;
    const parsed = new Date(iso);
    if (!isNaN(parsed.getTime())) return parsed;
  }
  const parsed = parseISO(dateStr);
  return isNaN(parsed.getTime()) ? null : parsed;
}

function mapLeadToTaskData(lead: HostfullyLead) {
  const checkIn = parseDateTime(lead.arrivalDate, lead.arrivalTime);
  const checkOut = parseDateTime(lead.departureDate, lead.departureTime);
  const nights =
    checkIn && checkOut ? differenceInCalendarDays(checkOut, checkIn) : 0;
  const guests =
    (lead.numAdults || 0) + (lead.numChildren || 0) + (lead.numInfants || 0);

  const checkoutTime = checkOut ? format(checkOut, "HH:mm") : null;
  const checkinWindow = checkIn ? format(checkIn, "HH:mm") : null;

  return {
    checkIn,
    checkOut,
    nights,
    guests,
    checkoutTime,
    checkinWindow,
  };
}

async function processReservation(lead: HostfullyLead) {
  const reservation = await prisma.hostfullyReservation.upsert({
    where: { externalId: lead.uid },
    create: {
      externalId: lead.uid,
      rawPayload: lead as any,
      status: lead.status ?? "UNKNOWN",
      checkIn: parseDateTime(lead.arrivalDate, lead.arrivalTime),
      checkOut: parseDateTime(lead.departureDate, lead.departureTime),
      guestsCount:
        (lead.numAdults || 0) +
        (lead.numChildren || 0) +
        (lead.numInfants || 0),
      nightsCount:
        parseDateTime(lead.arrivalDate, lead.arrivalTime) &&
        parseDateTime(lead.departureDate, lead.departureTime)
          ? differenceInCalendarDays(
              parseDateTime(lead.departureDate, lead.departureTime)!,
              parseDateTime(lead.arrivalDate, lead.arrivalTime)!,
            )
          : 0,
    },
    update: {
      rawPayload: lead as any,
      status: lead.status ?? "UNKNOWN",
      checkIn: parseDateTime(lead.arrivalDate, lead.arrivalTime),
      checkOut: parseDateTime(lead.departureDate, lead.departureTime),
      guestsCount:
        (lead.numAdults || 0) +
        (lead.numChildren || 0) +
        (lead.numInfants || 0),
      nightsCount:
        parseDateTime(lead.arrivalDate, lead.arrivalTime) &&
        parseDateTime(lead.departureDate, lead.departureTime)
          ? differenceInCalendarDays(
              parseDateTime(lead.departureDate, lead.departureTime)!,
              parseDateTime(lead.arrivalDate, lead.arrivalTime)!,
            )
          : 0,
      lastSyncedAt: new Date(),
    },
  });

  if (!lead.propertyUid) {
    return { reservation, task: null, skipped: "No propertyUid" };
  }

  const property = await fetchAndCacheProperty(lead.propertyUid);
  if (!property) {
    return { reservation, task: null, skipped: "Property not found" };
  }

  const apartment = await findOrCreateApartment(property);
  await prisma.hostfullyReservation.update({
    where: { id: reservation.id },
    data: { apartmentId: apartment.id },
  });

  const { checkOut, guests, nights, checkoutTime, checkinWindow } =
    mapLeadToTaskData(lead);
  if (!checkOut) {
    return { reservation, task: null, skipped: "No checkout date" };
  }

  const cleaningDate = new Date(
    checkOut.getFullYear(),
    checkOut.getMonth(),
    checkOut.getDate(),
  );

  // Cancellation handling
  const isCancelled = lead.status?.toUpperCase().includes("CANCELLED") ?? false;

  const taskPayload = {
    apartmentId: apartment.id,
    date: cleaningDate,
    type: TaskType.CLEANING,
    status: isCancelled ? TaskStatus.DONE : TaskStatus.TODO,
    checkoutTime,
    checkinWindow,
    guestsCount: guests || null,
    nightsCount: nights || null,
    requests: lead.specialRequests || null,
    instructions: lead.notes || null,
  };

  const existingTask = await prisma.task.findUnique({
    where: { externalHostfullyReservationId: lead.uid },
  });

  let task;
  if (existingTask) {
    task = await prisma.task.update({
      where: { id: existingTask.id },
      data: { ...taskPayload, externalHostfullyReservationId: lead.uid },
    });
  } else {
    // Idempotency: avoid duplicate for same lead on same date
    const duplicate = await prisma.task.findFirst({
      where: {
        apartmentId: apartment.id,
        date: cleaningDate,
        externalHostfullyReservationId: null,
      },
    });
    if (duplicate) {
      task = await prisma.task.update({
        where: { id: duplicate.id },
        data: { ...taskPayload, externalHostfullyReservationId: lead.uid },
      });
    } else {
      const systemUser = await prisma.user.findFirst({
        where: { role: "COORDINATOR" },
        orderBy: { createdAt: "asc" },
      });
      task = await prisma.task.create({
        data: {
          ...taskPayload,
          externalHostfullyReservationId: lead.uid,
          createdByUserId: systemUser?.id ?? "system",
        },
      });
    }
  }

  return { reservation, task, skipped: null };
}

const propertyCache = new Map<string, HostfullyProperty | null>();

async function fetchAndCacheProperty(
  uid: string,
): Promise<HostfullyProperty | null> {
  if (propertyCache.has(uid)) return propertyCache.get(uid) ?? null;
  try {
    const { getProperty } = await import("./client");
    const property = await getProperty(uid);
    propertyCache.set(uid, property);
    return property;
  } catch {
    propertyCache.set(uid, null);
    return null;
  }
}

export async function syncHostfully(since?: Date) {
  const results = {
    properties: 0,
    reservations: 0,
    tasksCreated: 0,
    tasksUpdated: 0,
    skipped: 0,
    errors: [] as { message: string; leadUid?: string }[],
  };

  try {
    const properties = await getProperties();
    for (const property of properties) {
      try {
        await findOrCreateApartment(property);
        results.properties++;
      } catch (err: any) {
        results.errors.push({
          message: `Property ${property.uid}: ${err.message}`,
        });
      }
    }
  } catch (err: any) {
    results.errors.push({ message: `Properties fetch failed: ${err.message}` });
  }

  try {
    const leads = await getLeads(since);
    for (const lead of leads) {
      try {
        const { task, skipped } = await processReservation(lead);
        results.reservations++;
        if (skipped) {
          results.skipped++;
        } else if (task) {
          const existing = await prisma.task.findUnique({
            where: { externalHostfullyReservationId: lead.uid },
          });
          if (existing?.updatedAt.getTime() === task.updatedAt.getTime()) {
            results.tasksCreated++;
          } else {
            results.tasksUpdated++;
          }
        }
      } catch (err: any) {
        results.errors.push({ message: err.message, leadUid: lead.uid });
      }
    }
  } catch (err: any) {
    results.errors.push({ message: `Leads fetch failed: ${err.message}` });
  }

  // Record sync audit
  try {
    const systemUser = await prisma.user.findFirst({
      where: { role: "COORDINATOR" },
      orderBy: { createdAt: "asc" },
    });
    await logAudit({
      userId: systemUser?.id ?? "system",
      action: "HOSTFULLY_SYNC",
      newValue: results,
    });
  } catch {
    // ignore audit failure
  }

  return results;
}

export async function syncHostfullyLead(leadUid: string) {
  const lead = await getLead(leadUid);
  if (!lead) throw new Error("Lead not found in Hostfully");
  return processReservation(lead);
}

export async function syncHostfullyProperty(propertyUid: string) {
  const { getProperty } = await import("./client");
  const property = await getProperty(propertyUid);
  if (!property) throw new Error("Property not found in Hostfully");
  return findOrCreateApartment(property);
}
