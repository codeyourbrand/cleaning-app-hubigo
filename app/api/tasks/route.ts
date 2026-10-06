import { NextRequest, NextResponse } from "next/server";
import { withRole, requireUser } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { taskCreateSchema } from "@/lib/schemas";
import { Role, TaskStatus } from "@prisma/client";
import { logAudit } from "@/lib/audit";
import { startOfDay, endOfDay, parseISO } from "date-fns";

export const GET = withRole(
  [Role.CLEANER, Role.COORDINATOR],
  async (req, ctx) => {
    const user = await requireUser(ctx.user);
    const { searchParams } = new URL(req.url);
    const dateParam = searchParams.get("date");
    const status = searchParams.get("status") as TaskStatus | null;
    const apartmentId = searchParams.get("apartmentId");
    const myTasks = searchParams.get("myTasks") === "true";

    const where: any = {};
    if (dateParam) {
      const date = parseISO(`${dateParam}T00:00:00Z`);
      where.date = { gte: startOfDay(date), lte: endOfDay(date) };
    }
    if (status) where.status = status;
    if (apartmentId) where.apartmentId = apartmentId;
    if (myTasks && user.role === Role.CLEANER) {
      where.assignedToUserId = user.id;
    }

    const tasks = await prisma.task.findMany({
      where,
      orderBy: [{ date: "asc" }, { createdAt: "asc" }],
      include: {
        apartment: true,
        assignedTo: { select: { id: true, name: true, avatarUrl: true } },
        steps: { orderBy: { order: "asc" } },
        _count: { select: { comments: true, media: true } },
      },
    });

    return NextResponse.json({ tasks });
  },
);

export const POST = withRole([Role.COORDINATOR], async (req, ctx) => {
  const body = await req.json();
  const parsed = taskCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", issues: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const {
    apartmentId,
    title,
    date,
    type,
    customTypeName,
    checkoutTime,
    checkinWindow,
    guestsCount,
    nightsCount,
    requests,
    instructions,
    assignedToUserId,
    steps,
  } = parsed.data;

  // Normalize to UTC midnight to avoid timezone issues
  const normalizedDate = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );

  const task = await prisma.task.create({
    data: {
      apartmentId,
      title,
      date: normalizedDate,
      type,
      customTypeName,
      checkoutTime,
      checkinWindow,
      guestsCount,
      nightsCount,
      requests,
      instructions,
      assignedToUserId,
      createdByUserId: ctx.user.userId,
      steps: {
        create: steps.map((name, idx) => ({ name, order: idx })),
      },
    },
    include: { apartment: true, steps: true },
  });

  await logAudit({
    userId: ctx.user.userId,
    taskId: task.id,
    action: "TASK_CREATED",
    newValue: { id: task.id, apartmentId, type, date, assignedToUserId },
  });

  if (assignedToUserId) {
    await logAudit({
      userId: ctx.user.userId,
      taskId: task.id,
      action: "TASK_ASSIGNED",
      newValue: { assignedToUserId },
    });
  }

  return NextResponse.json({ task }, { status: 201 });
});
