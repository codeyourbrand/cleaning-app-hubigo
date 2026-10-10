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
            assignedTo: {
              include: {
                user: { select: { id: true, name: true, avatarUrl: true } },
              },
            },
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

/**
 * DELETE /api/apartments/:id[?force=true]
 * An apartment with tasks is only deleted with force=true, which also removes
 * its tasks (cascade). Without it the response carries the task count.
 */
export const DELETE = withRole([Role.COORDINATOR], async (req, ctx) => {
  const id = ctx.params?.id as string;
  const force = new URL(req.url).searchParams.get("force") === "true";

  const apartment = await prisma.apartment.findUnique({
    where: { id },
    include: { _count: { select: { tasks: true } } },
  });
  if (!apartment) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const taskCount = apartment._count.tasks;
  if (taskCount > 0 && !force) {
    return NextResponse.json(
      { error: "Apartment has existing tasks", taskCount },
      { status: 409 },
    );
  }

  await prisma.apartment.delete({ where: { id } });
  await logAudit({
    userId: ctx.user.userId,
    action: "APARTMENT_DELETED",
    oldValue: {
      id,
      number: apartment.number,
      building: apartment.building,
      tasksDeleted: taskCount,
    },
  });
  return NextResponse.json({ ok: true });
});
