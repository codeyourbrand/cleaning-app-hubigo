import { NextRequest, NextResponse } from "next/server";
import { withRole } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { Role } from "@prisma/client";

const NOTE_KINDS = [
  "GENERAL",
  "WEEKLY_NOTE",
  "MAINTENANCE",
  "IN_CHARGE",
] as const;
type NoteKind = (typeof NOTE_KINDS)[number];

function isNoteKind(value: unknown): value is NoteKind {
  return typeof value === "string" && NOTE_KINDS.includes(value as NoteKind);
}

export const POST = withRole([Role.COORDINATOR], async (req: NextRequest) => {
  const body = await req.json();
  const { date, note, sortOrder } = body;
  const kind: NoteKind = isNoteKind(body.kind) ? body.kind : "GENERAL";
  if (!date || typeof note !== "string" || !note.trim()) {
    return NextResponse.json(
      { error: "date and note are required" },
      { status: 400 },
    );
  }

  const dateValue = new Date(`${date}T00:00:00Z`);
  if (Number.isNaN(dateValue.getTime())) {
    return NextResponse.json({ error: "Invalid date" }, { status: 400 });
  }

  if (kind !== "GENERAL") {
    const existing = await prisma.scheduleNote.findFirst({
      where: { date: dateValue, kind },
    });
    if (existing) {
      const updated = await prisma.scheduleNote.update({
        where: { id: existing.id },
        data: { note: note.trim(), sortOrder: sortOrder ?? existing.sortOrder },
      });
      return NextResponse.json({ note: updated });
    }
  }

  const created = await prisma.scheduleNote.create({
    data: {
      date: dateValue,
      note: note.trim(),
      kind,
      sortOrder: sortOrder ?? 0,
    },
  });
  return NextResponse.json({ note: created }, { status: 201 });
});

export const PATCH = withRole([Role.COORDINATOR], async (req: NextRequest) => {
  const body = await req.json();
  const { id, note } = body;
  if (!id || typeof note !== "string" || !note.trim()) {
    return NextResponse.json(
      { error: "id and note are required" },
      { status: 400 },
    );
  }

  const updated = await prisma.scheduleNote.update({
    where: { id },
    data: { note: note.trim() },
  });
  return NextResponse.json({ note: updated });
});

export const DELETE = withRole([Role.COORDINATOR], async (req: NextRequest) => {
  const body = await req.json();
  const { id } = body;
  if (!id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }
  await prisma.scheduleNote.delete({ where: { id } });
  return NextResponse.json({ ok: true });
});
