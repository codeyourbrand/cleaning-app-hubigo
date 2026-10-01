import { createHmac } from "crypto";
import { prisma } from "@/lib/prisma";
import { HostfullyWebhookPayload } from "./client";
import { syncHostfullyLead, syncHostfullyProperty } from "./sync";

export function verifyHostfullyWebhook(
  body: string,
  signature?: string,
): boolean {
  const secret = process.env.HOSTFULLY_WEBHOOK_SECRET;
  if (!secret) return true; // If no secret configured, accept (not recommended in production)
  if (!signature) return false;
  const expected = createHmac("sha256", secret).update(body).digest("hex");
  try {
    return signature === expected;
  } catch {
    return false;
  }
}

export async function handleHostfullyWebhook(event: HostfullyWebhookPayload) {
  const externalEventId = `${event.event_type}:${event.lead_uid ?? event.property_uid ?? event.agency_uid}:${Date.now()}`;
  const syncEvent = await prisma.syncEvent.create({
    data: {
      provider: "HOSTFULLY",
      externalEventId,
      eventType: event.event_type,
      payload: event as any,
      status: "PROCESSING",
    },
  });

  try {
    if (
      event.event_type === "NEW_BOOKING" ||
      event.event_type === "BOOKING_UPDATED" ||
      event.event_type === "BOOKING_CANCELLED"
    ) {
      if (event.lead_uid) {
        await syncHostfullyLead(event.lead_uid);
      }
    } else if (
      event.event_type === "NEW_PROPERTY" ||
      event.event_type === "UPDATED_PROPERTY" ||
      event.event_type === "ACTIVATED_PROPERTY" ||
      event.event_type === "DEACTIVATED_PROPERTY"
    ) {
      if (event.property_uid) {
        await syncHostfullyProperty(event.property_uid);
      }
    }

    await prisma.syncEvent.update({
      where: { id: syncEvent.id },
      data: { status: "PROCESSED", processedAt: new Date() },
    });
  } catch (err: any) {
    await prisma.syncEvent.update({
      where: { id: syncEvent.id },
      data: { status: "FAILED", error: err.message },
    });
    throw err;
  }
}
