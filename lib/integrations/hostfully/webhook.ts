import { timingSafeEqual } from "crypto";
import { prisma } from "@/lib/prisma";
import { HostfullyWebhookPayload, isHostfullyConfigured } from "./client";
import { syncHostfullyLead, syncHostfullyProperty } from "./sync";

const LEAD_EVENTS = new Set([
  "NEW_BOOKING",
  "BOOKING_UPDATED",
  "BOOKING_CANCELLED",
  "LEAD_DATES_CHANGED",
  "LEAD_PROPERTY_CHANGED",
  "LEAD_SOFT_DELETED",
  "PROPERTY_AVAILABILITY_UPDATED",
]);

const PROPERTY_EVENTS = new Set([
  "NEW_PROPERTY",
  "UPDATED_PROPERTY",
  "ACTIVATED_PROPERTY",
  "DEACTIVATED_PROPERTY",
]);

/**
 * Hostfully sends no signature header; the callback URL carries a shared
 * secret (?token=HOSTFULLY_WEBHOOK_SECRET) registered via
 * registerHostfullyWebhooks().
 */
export function verifyWebhookToken(token: string | null): {
  ok: boolean;
  status: number;
  error?: string;
} {
  const secret = process.env.HOSTFULLY_WEBHOOK_SECRET;
  if (!secret) {
    return { ok: false, status: 503, error: "Webhook secret not configured" };
  }
  if (!token) {
    return { ok: false, status: 401, error: "Missing token" };
  }
  const a = Buffer.from(token);
  const b = Buffer.from(secret);
  const valid = a.length === b.length && timingSafeEqual(a, b);
  return valid
    ? { ok: true, status: 200 }
    : { ok: false, status: 401, error: "Invalid token" };
}

export function verifyAgency(payload: HostfullyWebhookPayload): boolean {
  const agencyUid = process.env.HOSTFULLY_AGENCY_UID;
  if (!agencyUid) return isHostfullyConfigured() ? false : true;
  return payload.agency_uid === agencyUid;
}

export async function handleHostfullyWebhook(event: HostfullyWebhookPayload) {
  const externalEventId = `${event.event_type}:${event.lead_uid ?? event.property_uid ?? event.agency_uid}:${Date.now()}`;
  const syncEvent = await prisma.syncEvent.create({
    data: {
      provider: "HOSTFULLY",
      externalEventId,
      eventType: event.event_type,
      payload: event as object,
      status: "PROCESSING",
    },
  });

  try {
    if (LEAD_EVENTS.has(event.event_type) && event.lead_uid) {
      await syncHostfullyLead(event.lead_uid);
    } else if (PROPERTY_EVENTS.has(event.event_type) && event.property_uid) {
      await syncHostfullyProperty(event.property_uid);
    }
    // DELETED_PROPERTY and unknown event types: record only, no action.

    await prisma.syncEvent.update({
      where: { id: syncEvent.id },
      data: { status: "PROCESSED", processedAt: new Date() },
    });
  } catch (err) {
    await prisma.syncEvent.update({
      where: { id: syncEvent.id },
      data: { status: "FAILED", error: (err as Error).message },
    });
    throw err;
  }
}
