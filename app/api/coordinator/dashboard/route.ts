import { NextRequest, NextResponse } from "next/server";
import { withRole } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { Role } from "@prisma/client";
import { startOfDay, endOfDay, addDays } from "date-fns";

export const GET = withRole(
  [Role.COORDINATOR],
  async (req: NextRequest, ctx) => {
    const { searchParams } = new URL(req.url);
    const cleaner = searchParams.get("cleaner") || undefined;
    const building = searchParams.get("building") || undefined;
    const status = searchParams.get("status") as any;

    const baseWhere: any = {};
    if (cleaner && cleaner !== "") {
      if (cleaner === "me") {
        baseWhere.assignedTo = { some: { userId: ctx.user.userId } };
      } else {
        baseWhere.assignedTo = { some: { userId: cleaner } };
      }
    }
    if (building) {
      baseWhere.apartment = { building };
    }
    if (status && ["TODO", "IN_PROGRESS", "DONE"].includes(status)) {
      baseWhere.status = status;
    }

    const days = [0, 1, 2].map((offset) => {
      const date = addDays(new Date(), offset);
      return { start: startOfDay(date), end: endOfDay(date) };
    });

    // One query for the whole range (each query is a database round trip),
    // split into days afterwards. The order is preserved within each day.
    const [rawTasks, cleaners] = await Promise.all([
      prisma.task.findMany({
        where: {
          ...baseWhere,
          date: { gte: days[0].start, lte: days[2].end },
        },
        orderBy: [
          { checkoutTime: { sort: "asc", nulls: "last" } },
          { createdAt: "asc" },
        ],
        include: {
          apartment: { select: { id: true, number: true, building: true } },
          assignedTo: {
            include: {
              user: { select: { id: true, name: true } },
            },
          },
        },
      }),
      prisma.user.findMany({
        where: { role: Role.CLEANER, active: true },
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      }),
    ]);

    const tasks = rawTasks.map((t) => ({
      ...t,
      assignedTo: t.assignedTo.map((a) => a.user),
    }));

    const [today, tomorrow, dayAfter] = days.map((day) =>
      tasks.filter((t) => t.date >= day.start && t.date <= day.end),
    );

    return NextResponse.json({
      today,
      tomorrow,
      dayAfter,
      cleaners,
      counts: {
        todo: tasks.filter((t) => t.status === "TODO").length,
        inProgress: tasks.filter((t) => t.status === "IN_PROGRESS").length,
        done: tasks.filter((t) => t.status === "DONE").length,
      },
    });
  },
);
