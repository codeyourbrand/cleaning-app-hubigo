import { NextRequest, NextResponse } from "next/server";
import { withRole } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { Role } from "@prisma/client";
import { logAudit } from "@/lib/audit";
import { z } from "zod";

const updateItemSchema = z.object({
  name: z.string().min(1).optional(),
  quantity: z.number().int().min(0).optional(),
  checked: z.boolean().optional(),
  notes: z.string().optional().nullable(),
  order: z.number().int().min(0).optional(),
});

export const PATCH = withRole([Role.COORDINATOR, Role.CLEANER], async (req, ctx) => {
  const checklistId = ctx.params?.id as string;
  const itemId = ctx.params?.itemId as string;

  const body = await req.json();
  const parsed = updateItemSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", issues: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const old = await prisma.inventoryItem.findFirst({
    where: { id: itemId, checklistId },
    include: { checklist: { select: { name: true } } },
  });
  if (!old) {
    return NextResponse.json({ error: "Item not found" }, { status: 404 });
  }

  const data: any = {};
  if (parsed.data.name !== undefined) data.name = parsed.data.name;
  if (parsed.data.quantity !== undefined) data.quantity = parsed.data.quantity;
  if (parsed.data.notes !== undefined) data.notes = parsed.data.notes;
  if (parsed.data.order !== undefined) data.order = parsed.data.order;

  if (parsed.data.checked !== undefined) {
    data.checked = parsed.data.checked;
    data.checkedAt = parsed.data.checked ? new Date() : null;
    data.checkedByUserId = parsed.data.checked ? ctx.user.userId : null;
  }

  const item = await prisma.inventoryItem.update({
    where: { id: itemId },
    data,
    include: { checkedBy: { select: { id: true, name: true } } },
  });

  // Log check/uncheck separately
  if (parsed.data.checked !== undefined) {
    await logAudit({
      userId: ctx.user.userId,
      action: parsed.data.checked ? "INVENTORY_ITEM_CHECKED" : "INVENTORY_ITEM_UNCHECKED",
      newValue: {
        checklistId,
        checklistName: old.checklist.name,
        itemId,
        itemName: old.name,
      },
    });
  } else {
    await logAudit({
      userId: ctx.user.userId,
      action: "INVENTORY_ITEM_UPDATED",
      oldValue: { name: old.name, quantity: old.quantity, notes: old.notes },
      newValue: { name: item.name, quantity: item.quantity, notes: item.notes },
    });
  }

  return NextResponse.json({ item });
});

export const DELETE = withRole([Role.COORDINATOR], async (_req, ctx) => {
  const checklistId = ctx.params?.id as string;
  const itemId = ctx.params?.itemId as string;

  const old = await prisma.inventoryItem.findFirst({
    where: { id: itemId, checklistId },
    include: { checklist: { select: { name: true } } },
  });
  if (!old) {
    return NextResponse.json({ error: "Item not found" }, { status: 404 });
  }

  await prisma.inventoryItem.delete({ where: { id: itemId } });

  await logAudit({
    userId: ctx.user.userId,
    action: "INVENTORY_ITEM_DELETED",
    oldValue: {
      checklistId,
      checklistName: old.checklist.name,
      itemId,
      name: old.name,
      quantity: old.quantity,
    },
  });

  return NextResponse.json({ ok: true });
});
