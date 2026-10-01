import { NextResponse } from "next/server";
import { withRole } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { Role } from "@prisma/client";

export const GET = withRole([Role.COORDINATOR], async () => {
  const configured = Boolean(process.env.HOSTFULLY_API_KEY);
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
    lastSync: lastReservation?.lastSyncedAt?.toISOString() || null,
    events,
  });
});
