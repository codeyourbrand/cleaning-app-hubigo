import { NextRequest, NextResponse } from "next/server";
import { withRole } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { csvImportSchema } from "@/lib/schemas";
import { Role } from "@prisma/client";
import { logAudit } from "@/lib/audit";
import { startOfDay, endOfDay } from "date-fns";

export const POST = withRole([Role.COORDINATOR], async (req, ctx) => {
  const body = await req.json();
  const parsed = csvImportSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", issues: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const { rows, date: rawDate } = parsed.data;
  const date = new Date(
    Date.UTC(
      rawDate.getUTCFullYear(),
      rawDate.getUTCMonth(),
      rawDate.getUTCDate(),
    ),
  );
  const stats = {
    total: rows.length,
    valid: 0,
    invalid: 0,
    duplicates: 0,
    created: 0,
  };
  const results: {
    row: number;
    status: string;
    apartmentNumber: string;
    taskId?: string;
    error?: string;
  }[] = [];

  // Find or create apartments in bulk-ish
  const existingApartments = await prisma.apartment.findMany({
    where: { number: { in: rows.map((r) => r.apartmentNumber) } },
  });
  const apartmentMap = new Map(existingApartments.map((a) => [a.number, a]));

  // Existing tasks for this date to avoid duplicates
  const start = startOfDay(date);
  const end = endOfDay(date);
  const existingTasks = await prisma.task.findMany({
    where: { date: { gte: start, lte: end } },
    include: { apartment: true },
  });

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNum = i + 1;
    if (!row.apartmentNumber) {
      stats.invalid++;
      results.push({
        row: rowNum,
        status: "invalid",
        apartmentNumber: "",
        error: "Missing apartment number",
      });
      continue;
    }

    let apartment = apartmentMap.get(row.apartmentNumber);
    if (!apartment) {
      apartment = await prisma.apartment.create({
        data: { number: row.apartmentNumber },
      });
      apartmentMap.set(row.apartmentNumber, apartment);
    }

    const duplicate = existingTasks.find(
      (t) =>
        t.apartmentId === apartment.id &&
        t.checkoutTime === (row.checkoutTime || null) &&
        t.checkinWindow === (row.checkinWindow || null),
    );
    if (duplicate) {
      stats.duplicates++;
      results.push({
        row: rowNum,
        status: "duplicate",
        apartmentNumber: row.apartmentNumber,
        taskId: duplicate.id,
      });
      continue;
    }

    const task = await prisma.task.create({
      data: {
        apartmentId: apartment.id,
        date,
        type: "CLEANING",
        checkoutTime: row.checkoutTime || undefined,
        checkinWindow: row.checkinWindow || undefined,
        guestsCount: row.guestsCount,
        nightsCount: row.nightsCount,
        requests: row.requests || undefined,
        instructions: row.instructions || undefined,
        createdByUserId: ctx.user.userId,
      },
    });

    stats.valid++;
    stats.created++;
    results.push({
      row: rowNum,
      status: "created",
      apartmentNumber: row.apartmentNumber,
      taskId: task.id,
    });
  }

  await logAudit({
    userId: ctx.user.userId,
    action: "TASK_IMPORTED",
    newValue: { date: date.toISOString(), stats, results },
  });

  return NextResponse.json({ stats, results });
});
