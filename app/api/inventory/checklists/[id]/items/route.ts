import { NextRequest, NextResponse } from "next/server";
import { withRole } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { Role } from "@prisma/client";
import { logAudit } from "@/lib/audit";
import { z } from "zod";

const addItemSchema = z.object({
  name: z.string().min(1),
  quantity: z.number().int().min(0).optional().default(1),
  notes: z.string().optional(),
});

const bulkAddSchema = z.object({
  items: z.array(addItemSchema),
});

export const POST = withRole([Role.COORDINATOR], async (req, ctx) => {
  const checklistId = ctx.params?.id as string;

  const checklist = await prisma.inventoryChecklist.findUnique({
    where: { id: checklistId },
  });
  if (!checklist) {
    return NextResponse.json({ error: "Checklist not found" }, { status: 404 });
  }

  const body = await req.json();

  // Support both single item and bulk
  if (body.items) {
    const parsed = bulkAddSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", issues: parsed.error.flatten().fieldErrors },
        { status: 400 },
      );
    }

    const maxOrder = await prisma.inventoryItem.aggregate({
      where: { checklistId },
      _max: { order: true },
    });
    const startOrder = (maxOrder._max.order ?? -1) + 1;

    const created = await prisma.$transaction(
      parsed.data.items.map((item, idx) =>
        prisma.inventoryItem.create({
          data: {
            checklistId,
            name: item.name,
            quantity: item.quantity,
            notes: item.notes,
            order: startOrder + idx,
          },
        }),
      ),
    );

    await logAudit({
      userId: ctx.user.userId,
      action: "INVENTORY_ITEM_ADDED",
      newValue: {
        checklistId,
        checklistName: checklist.name,
        items: created.map((i) => ({ id: i.id, name: i.name })),
      },
    });

    return NextResponse.json({ items: created }, { status: 201 });
  }

  const parsed = addItemSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", issues: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const maxOrder = await prisma.inventoryItem.aggregate({
    where: { checklistId },
    _max: { order: true },
  });

  const item = await prisma.inventoryItem.create({
    data: {
      checklistId,
      name: parsed.data.name,
      quantity: parsed.data.quantity,
      notes: parsed.data.notes,
      order: (maxOrder._max.order ?? -1) + 1,
    },
  });

  await logAudit({
    userId: ctx.user.userId,
    action: "INVENTORY_ITEM_ADDED",
    newValue: {
      checklistId,
      checklistName: checklist.name,
      itemId: item.id,
      name: item.name,
      quantity: item.quantity,
    },
  });

  return NextResponse.json({ item }, { status: 201 });
});
