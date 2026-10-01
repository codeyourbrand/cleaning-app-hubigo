import { NextRequest, NextResponse } from "next/server";
import { withRole } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { Role } from "@prisma/client";
import { startOfDay, endOfDay, addDays } from "date-fns";

export const GET = withRole([Role.COORDINATOR], async (req: NextRequest, ctx) => {
  const { searchParams } = new URL(req.url);
  const cleaner = searchParams.get("cleaner") || undefined;
  const building = searchParams.get("building") || undefined;
  const status = searchParams.get("status") as any;

  const baseWhere: any = {};
  if (cleaner && cleaner !== "") {
    if (cleaner === "me") baseWhere.assignedToUserId = ctx.user.userId;
    else baseWhere.assignedToUserId = cleaner;
  }
  if (building) {
    baseWhere.apartment = { building };
  }
  if (status && ["TODO", "IN_PROGRESS", "DONE"].includes(status)) {
    baseWhere.status = status;
  }

  const days = [0, 1, 2].map((offset) => {
    const date = addDays(new Date(), offset);
    return {
      date,
      where: {
        ...baseWhere,
        date: { gte: startOfDay(date), lte: endOfDay(date) },
      },
    };
  });

  const [today, tomorrow, dayAfter, counts] = await Promise.all([
    prisma.task.findMany({
      where: days[0].where,
      orderBy: [{ status: "asc" }, { createdAt: "asc" }],
      include: {
        apartment: { select: { id: true, number: true, building: true } },
        assignedTo: { select: { id: true, name: true } },
      },
    }),
    prisma.task.findMany({
      where: days[1].where,
      orderBy: [{ status: "asc" }, { createdAt: "asc" }],
      include: {
        apartment: { select: { id: true, number: true, building: true } },
        assignedTo: { select: { id: true, name: true } },
      },
    }),
    prisma.task.findMany({
      where: days[2].where,
      orderBy: [{ status: "asc" }, { createdAt: "asc" }],
      include: {
        apartment: { select: { id: true, number: true, building: true } },
        assignedTo: { select: { id: true, name: true } },
      },
    }),
    prisma.task.groupBy({
      by: ["status"],
      where: {
        date: { gte: startOfDay(new Date()), lte: endOfDay(addDays(new Date(), 2)) },
        ...baseWhere,
      },
      _count: { status: true },
    }),
  ]);

  const countsMap = { TODO: 0, IN_PROGRESS: 0, DONE: 0 };
  for (const group of counts) {
    countsMap[group.status as keyof typeof countsMap] = group._count.status;
  }

  return NextResponse.json({
    today,
    tomorrow,
    dayAfter,
    counts: countsMap,
  });
});
