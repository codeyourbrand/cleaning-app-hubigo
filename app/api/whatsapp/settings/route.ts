import { NextRequest, NextResponse } from "next/server";
import { withRole } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { Role } from "@prisma/client";
import {
  WHATSAPP_DESTINATION_LABELS,
  WHATSAPP_EVENT_LABELS,
  isWhatsAppConfigured,
  type WhatsAppDestination,
  type WhatsAppEventType,
} from "@/lib/whatsapp";

const VALID_EVENT_TYPES = Object.keys(
  WHATSAPP_EVENT_LABELS,
) as WhatsAppEventType[];
const VALID_DESTINATIONS = Object.keys(
  WHATSAPP_DESTINATION_LABELS,
) as WhatsAppDestination[];

/** GET — return all settings (seed defaults for missing event types). */
export const GET = withRole([Role.COORDINATOR], async () => {
  const existing = await prisma.whatsAppNotificationSetting.findMany();
  const byType = new Map(existing.map((s) => [s.eventType, s]));

  // Ensure every known event type has a row
  const toCreate = VALID_EVENT_TYPES.filter((t) => !byType.has(t));
  if (toCreate.length > 0) {
    await prisma.whatsAppNotificationSetting.createMany({
      data: toCreate.map((eventType) => ({ eventType, enabled: false })),
      skipDuplicates: true,
    });
  }

  const settings = await prisma.whatsAppNotificationSetting.findMany({
    orderBy: { eventType: "asc" },
  });

  return NextResponse.json({
    settings,
    configured: isWhatsAppConfigured(),
    labels: WHATSAPP_EVENT_LABELS,
    destinationLabels: WHATSAPP_DESTINATION_LABELS,
  });
});

/** PATCH — bulk-update settings. Body: { updates: [{ eventType, enabled?, destination? }] } */
export const PATCH = withRole([Role.COORDINATOR], async (req: NextRequest) => {
  const body = await req.json();
  const updates: {
    eventType: string;
    enabled?: boolean;
    destination?: string;
  }[] = body.updates;

  if (!Array.isArray(updates)) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  for (const { eventType, enabled, destination } of updates) {
    if (!VALID_EVENT_TYPES.includes(eventType as WhatsAppEventType)) continue;
    if (
      destination !== undefined &&
      !VALID_DESTINATIONS.includes(destination as WhatsAppDestination)
    )
      continue;
    const data = {
      ...(enabled !== undefined ? { enabled } : {}),
      ...(destination !== undefined ? { destination } : {}),
    };
    await prisma.whatsAppNotificationSetting.upsert({
      where: { eventType },
      create: {
        eventType,
        enabled: enabled ?? false,
        destination: destination ?? "GROUP",
      },
      update: data,
    });
  }

  const settings = await prisma.whatsAppNotificationSetting.findMany({
    orderBy: { eventType: "asc" },
  });

  return NextResponse.json({ settings });
});
