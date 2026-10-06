import { NextRequest, NextResponse } from "next/server";
import { withRole } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { Role } from "@prisma/client";

/**
 * POST /api/schedule/shifts — upsert a shift for user+date
 * Body: { userId, date (YYYY-MM-DD), startTime?, endTime?, dayOff?, note? }
 *
 * Also accepts { bulk: [{ userId, date, ... }, ...] } for batch upsert.
 */
export const POST = withRole([Role.COORDINATOR], async (req: NextRequest) => {
  const body = await req.json();

  if (body.bulk && Array.isArray(body.bulk)) {
    const results = [];
    for (const item of body.bulk) {
      results.push(await upsertShift(item));
    }
    return NextResponse.json({ shifts: results });
  }

  const shift = await upsertShift(body);
  return NextResponse.json({ shift });
});

async function upsertShift(data: {
  userId: string;
  date: string;
  startTime?: string | null;
  endTime?: string | null;
  dayOff?: boolean;
  note?: string | null;
}) {
  const { userId, date, startTime, endTime, dayOff, note } = data;
  const dateUtc = new Date(`${date}T00:00:00Z`);

  return prisma.cleanerShift.upsert({
    where: {
      cleaner_shift_user_date: {
        userId,
        date: dateUtc,
      },
    },
    create: {
      userId,
      date: dateUtc,
      startTime: startTime ?? null,
      endTime: endTime ?? null,
      dayOff: dayOff ?? false,
      note: note ?? null,
    },
    update: {
      startTime: startTime ?? null,
      endTime: endTime ?? null,
      dayOff: dayOff ?? false,
      note: note ?? null,
    },
    include: { user: { select: { id: true, name: true } } },
  });
}
