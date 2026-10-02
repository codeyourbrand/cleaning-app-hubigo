import { NextResponse } from "next/server";
import { withRole } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { isHostfullyConfigured } from "@/lib/integrations/hostfully/client";
import { Role } from "@prisma/client";

export const GET = withRole([Role.COORDINATOR], async () => {
  const configured = isHostfullyConfigured();
  const baseUrl =
    process.env.HOSTFULLY_API_BASE_URL ?? "https://api.hostfully.com/api/v3.3";
  const environment = baseUrl.includes("sandbox") ? "sandbox" : "production";
  const webhookConfigured = Boolean(process.env.HOSTFULLY_WEBHOOK_SECRET);

  const lastReservation = await prisma.hostfullyReservation.findFirst({
    orderBy: { lastSyncedAt: "desc" },
  });
  const events = await prisma.syncEvent.findMany({
    where: { provider: "HOSTFULLY" },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  return NextResponse.json({
    configured,
    webhookConfigured,
    environment,
    lastSync: lastReservation?.lastSyncedAt?.toISOString() || null,
    events,
  });
});
