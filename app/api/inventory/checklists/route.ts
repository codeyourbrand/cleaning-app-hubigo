import { NextRequest, NextResponse } from "next/server";
import { withRole } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { Role } from "@prisma/client";
import { logAudit } from "@/lib/audit";
import { z } from "zod";

const createSchema = z.object({
  name: z.string().min(1),
  type: z.enum(["APARTMENT", "STORAGE"]),
  apartmentId: z.string().cuid().optional().nullable(),
  notes: z.string().optional(),
  items: z
    .array(
      z.object({
        name: z.string().min(1),
        quantity: z.number().int().min(0).optional().default(1),
        notes: z.string().optional(),
      }),
    )
    .optional()
    .default([]),
});

export const GET = withRole([Role.COORDINATOR, Role.CLEANER], async (req) => {
  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type") as "APARTMENT" | "STORAGE" | null;
  const apartmentId = searchParams.get("apartmentId");
  const search = searchParams.get("search");
  const sortBy = searchParams.get("sortBy") || "name";
  const sortDir = searchParams.get("sortDir") === "desc" ? "desc" : "asc";

  const where: any = {};
  if (type) where.type = type;
  if (apartmentId) where.apartmentId = apartmentId;
  if (search) {
    where.OR = [
      { name: { contains: search, mode: "insensitive" } },
      { apartment: { number: { contains: search, mode: "insensitive" } } },
    ];
  }

  const orderBy: any =
    sortBy === "apartment"
      ? { apartment: { number: sortDir } }
      : sortBy === "updatedAt"
        ? { updatedAt: sortDir }
        : { name: sortDir };

  const checklists = await prisma.inventoryChecklist.findMany({
    where,
    orderBy,
    include: {
      apartment: { select: { id: true, number: true, building: true } },
      createdBy: { select: { id: true, name: true } },
      _count: { select: { items: true } },
    },
  });

  return NextResponse.json({ checklists });
});

export const POST = withRole([Role.COORDINATOR], async (req, ctx) => {
  const body = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", issues: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const { name, type, apartmentId, notes, items } = parsed.data;

  const checklist = await prisma.inventoryChecklist.create({
    data: {
      name,
      type,
      apartmentId: apartmentId ?? undefined,
      notes,
      createdByUserId: ctx.user.userId,
      items: {
        create: items.map((item, idx) => ({
          name: item.name,
          quantity: item.quantity,
          notes: item.notes,
          order: idx,
        })),
      },
    },
    include: {
      apartment: { select: { id: true, number: true, building: true } },
      items: { orderBy: { order: "asc" } },
    },
  });

  await logAudit({
    userId: ctx.user.userId,
    action: "INVENTORY_CHECKLIST_CREATED",
    newValue: { id: checklist.id, name, type, apartmentId, itemCount: items.length },
  });

  return NextResponse.json({ checklist }, { status: 201 });
});
