import { NextRequest, NextResponse } from "next/server";
import { withRole } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { Role } from "@prisma/client";
import { startOfDay, endOfDay, startOfWeek, addDays, parseISO } from "date-fns";

/**
 * GET /api/schedule?date=YYYY-MM-DD         — daily schedule
 * GET /api/schedule?week=YYYY-MM-DD         — weekly schedule (Mon-Sun)
 */
export const GET = withRole([Role.COORDINATOR], async (req: NextRequest) => {
  const { searchParams } = new URL(req.url);
  const dateParam = searchParams.get("date");
  const weekParam = searchParams.get("week");

  if (weekParam) {
    return weeklySchedule(weekParam);
  }

  const targetDate = dateParam
    ? parseISO(`${dateParam}T00:00:00Z`)
    : new Date();

  return dailySchedule(targetDate);
});

async function dailySchedule(date: Date) {
  const dayStart = startOfDay(date);
  const dayEnd = endOfDay(date);

  const [tasks, shifts, notes, cleaners] = await Promise.all([
    prisma.task.findMany({
      where: { date: { gte: dayStart, lte: dayEnd } },
      orderBy: [{ checkoutTime: "asc" }, { createdAt: "asc" }],
      include: {
        apartment: { select: { id: true, number: true, building: true } },
        assignedTo: { select: { id: true, name: true } },
      },
    }),
    prisma.cleanerShift.findMany({
      where: { date: { gte: dayStart, lte: dayEnd } },
      include: { user: { select: { id: true, name: true } } },
    }),
    prisma.scheduleNote.findMany({
      where: { date: { gte: dayStart, lte: dayEnd } },
      orderBy: { sortOrder: "asc" },
    }),
    prisma.user.findMany({
      where: { role: Role.CLEANER, active: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  return NextResponse.json({ tasks, shifts, notes, cleaners, date: dayStart });
}

async function weeklySchedule(weekDate: string) {
  const anchor = parseISO(`${weekDate}T00:00:00Z`);
  const weekStart = startOfWeek(anchor, { weekStartsOn: 1 }); // Monday
  const weekEnd = endOfDay(addDays(weekStart, 6)); // Sunday

  const [shifts, tasks, cleaners, notes] = await Promise.all([
    prisma.cleanerShift.findMany({
      where: { date: { gte: weekStart, lte: weekEnd } },
      include: { user: { select: { id: true, name: true } } },
      orderBy: [{ date: "asc" }],
    }),
    prisma.task.findMany({
      where: { date: { gte: weekStart, lte: weekEnd } },
      orderBy: [{ date: "asc" }, { checkoutTime: "asc" }],
      include: {
        apartment: { select: { id: true, number: true, building: true } },
        assignedTo: { select: { id: true, name: true } },
      },
    }),
    prisma.user.findMany({
      where: { role: Role.CLEANER, active: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.scheduleNote.findMany({
      where: { date: { gte: weekStart, lte: weekEnd } },
      orderBy: [{ date: "asc" }, { sortOrder: "asc" }],
    }),
  ]);

  // Build 7-day array
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = addDays(weekStart, i);
    const dateStr = d.toISOString().slice(0, 10);
    return {
      date: dateStr,
      dayOfWeek: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"][i],
      shifts: shifts.filter(
        (s) => s.date.toISOString().slice(0, 10) === dateStr,
      ),
      tasks: tasks.filter(
        (t) => t.date.toISOString().slice(0, 10) === dateStr,
      ),
      notes: notes.filter(
        (n) => n.date.toISOString().slice(0, 10) === dateStr,
      ),
    };
  });

  return NextResponse.json({ days, cleaners, weekStart });
}
