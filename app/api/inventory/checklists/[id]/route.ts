import { NextRequest, NextResponse } from "next/server";
import { withRole } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { Role } from "@prisma/client";
import { logAudit } from "@/lib/audit";
import { z } from "zod";

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  notes: z.string().optional().nullable(),
  apartmentId: z.string().cuid().optional().nullable(),
});

export const GET = withRole([Role.COORDINATOR, Role.CLEANER], async (_req, ctx) => {
  const id = ctx.params?.id as string;
  const checklist = await prisma.inventoryChecklist.findUnique({
    where: { id },
    include: {
      apartment: { select: { id: true, number: true, building: true, floor: true } },
      createdBy: { select: { id: true, name: true } },
      items: {
        orderBy: { order: "asc" },
        include: {
          checkedBy: { select: { id: true, name: true } },
        },
      },
    },
  });
  if (!checklist) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ checklist });
});

export const PATCH = withRole([Role.COORDINATOR], async (req, ctx) => {
  const id = ctx.params?.id as string;
  const body = await req.json();
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", issues: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const old = await prisma.inventoryChecklist.findUnique({ where: { id } });
  if (!old) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const checklist = await prisma.inventoryChecklist.update({
    where: { id },
    data: parsed.data,
    include: {
      apartment: { select: { id: true, number: true, building: true } },
      items: { orderBy: { order: "asc" } },
    },
  });

  await logAudit({
    userId: ctx.user.userId,
    action: "INVENTORY_CHECKLIST_UPDATED",
    oldValue: { name: old.name, notes: old.notes },
    newValue: { name: checklist.name, notes: checklist.notes },
  });

  return NextResponse.json({ checklist });
});

export const DELETE = withRole([Role.COORDINATOR], async (_req, ctx) => {
  const id = ctx.params?.id as string;
  const old = await prisma.inventoryChecklist.findUnique({ where: { id } });
  if (!old) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.inventoryChecklist.delete({ where: { id } });

  await logAudit({
    userId: ctx.user.userId,
    action: "INVENTORY_CHECKLIST_DELETED",
    oldValue: { id, name: old.name, type: old.type },
  });

  return NextResponse.json({ ok: true });
});
