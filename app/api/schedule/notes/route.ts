import { NextRequest, NextResponse } from "next/server";
import { withRole } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { Role } from "@prisma/client";

/**
 * POST /api/schedule/notes — create a schedule note (break, header, etc.)
 * Body: { date (YYYY-MM-DD), note, sortOrder? }
 */
export const POST = withRole([Role.COORDINATOR], async (req: NextRequest) => {
  const body = await req.json();
  const { date, note, sortOrder } = body;
  if (!date || !note) {
    return NextResponse.json({ error: "date and note are required" }, { status: 400 });
  }

  const created = await prisma.scheduleNote.create({
    data: {
      date: new Date(`${date}T00:00:00Z`),
      note,
      sortOrder: sortOrder ?? 0,
    },
  });
  return NextResponse.json({ note: created }, { status: 201 });
});

/**
 * DELETE /api/schedule/notes — delete a schedule note
 * Body: { id }
 */
export const DELETE = withRole([Role.COORDINATOR], async (req: NextRequest) => {
  const body = await req.json();
  const { id } = body;
  if (!id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }
  await prisma.scheduleNote.delete({ where: { id } });
  return NextResponse.json({ ok: true });
});
