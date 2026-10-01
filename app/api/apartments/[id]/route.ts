import { NextRequest, NextResponse } from "next/server";
import { withRole } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { apartmentSchema } from "@/lib/schemas";
import { Role } from "@prisma/client";
import { logAudit } from "@/lib/audit";

export const GET = withRole(
  [Role.CLEANER, Role.COORDINATOR],
  async (_req, ctx) => {
    const id = ctx.params?.id as string;
    const apartment = await prisma.apartment.findUnique({
      where: { id },
      include: {
        lostFounds: { orderBy: { createdAt: "desc" }, take: 50 },
        damages: { orderBy: { createdAt: "desc" }, take: 50 },
        tasks: {
          orderBy: { date: "desc" },
          take: 100,
          include: {
            assignedTo: { select: { id: true, name: true, avatarUrl: true } },
            media: true,
          },
        },
      },
    });
    if (!apartment) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({ apartment });
  },
);

export const PATCH = withRole([Role.COORDINATOR], async (req, ctx) => {
  const id = ctx.params?.id as string;
  const body = await req.json();
  const parsed = apartmentSchema.partial().safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", issues: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  try {
    const apartment = await prisma.apartment.update({
      where: { id },
      data: parsed.data,
    });
    await logAudit({
      userId: ctx.user.userId,
      action: "APARTMENT_UPDATED",
      newValue: parsed.data,
    });
    return NextResponse.json({ apartment });
  } catch (err: any) {
    if (err.code === "P2002") {
      return NextResponse.json(
        { error: "Apartment number already exists in this building" },
        { status: 409 },
      );
    }
    if (err.code === "P2025") {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    throw err;
  }
});

export const DELETE = withRole([Role.COORDINATOR], async (_req, ctx) => {
  const id = ctx.params?.id as string;
  const count = await prisma.task.count({ where: { apartmentId: id } });
  if (count > 0) {
    return NextResponse.json(
      { error: "Cannot delete apartment with existing tasks" },
      { status: 409 },
    );
  }
  await prisma.apartment.delete({ where: { id } });
  return NextResponse.json({ ok: true });
});
