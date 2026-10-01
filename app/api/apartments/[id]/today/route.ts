import { NextResponse } from "next/server";
import { withRole } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { Role } from "@prisma/client";
import { startOfDay, endOfDay } from "date-fns";

export const GET = withRole([Role.CLEANER, Role.COORDINATOR], async (_req, ctx) => {
  const id = ctx.params?.id as string;
  const apartment = await prisma.apartment.findUnique({ where: { id } });
  if (!apartment) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const now = new Date();
  const task = await prisma.task.findFirst({
    where: {
      apartmentId: id,
      date: { gte: startOfDay(now), lte: endOfDay(now) },
    },
    select: { id: true, status: true, checkoutTime: true, checkinWindow: true },
  });
  return NextResponse.json({ apartment, task });
});
