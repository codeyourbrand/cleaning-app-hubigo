import { NextRequest, NextResponse } from "next/server";
import { withRole } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { taskUpdateSchema } from "@/lib/schemas";
import { Prisma, Role } from "@prisma/client";
import { logAudit } from "@/lib/audit";

export const GET = withRole(
  [Role.CLEANER, Role.COORDINATOR],
  async (_req, ctx) => {
    const id = ctx.params?.id as string;
    const task = await prisma.task.findUnique({
      where: { id },
      include: {
        apartment: true,
        assignedTo: {
          include: {
            user: { select: { id: true, name: true, avatarUrl: true } },
          },
        },
        createdBy: { select: { id: true, name: true } },
        startedBy: { select: { id: true, name: true } },
        doneBy: { select: { id: true, name: true } },
        steps: { orderBy: { order: "asc" } },
        media: true,
        comments: {
          orderBy: { createdAt: "asc" },
          include: {
            author: { select: { id: true, name: true, avatarUrl: true } },
            media: true,
            replies: {
              include: {
                author: { select: { id: true, name: true, avatarUrl: true } },
                media: true,
              },
            },
          },
        },
      },
    });
    if (!task) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({
      task: { ...task, assignedTo: task.assignedTo.map((a) => a.user) },
      permissions: { canDelete: ctx.user.role === Role.COORDINATOR },
    });
  },
);

export const PATCH = withRole([Role.COORDINATOR], async (req, ctx) => {
  const id = ctx.params?.id as string;
  const body = await req.json();
  const parsed = taskUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", issues: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const oldTask = await prisma.task.findUnique({
    where: { id },
    include: {
      assignedTo: {
        include: { user: { select: { id: true, name: true } } },
      },
    },
  });
  if (!oldTask) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { assignedToUserIds, ...rest } = parsed.data;
  const data: Prisma.TaskUpdateInput = { ...rest };

  if (assignedToUserIds !== undefined) {
    const currentIds = oldTask.assignedTo.map((a) => a.userId);
    const newIds = assignedToUserIds ?? [];
    const toRemove = currentIds.filter((uid) => !newIds.includes(uid));
    const toAdd = newIds.filter((uid) => !currentIds.includes(uid));
    data.assignedTo = {
      deleteMany:
        toRemove.length > 0 ? { userId: { in: toRemove } } : undefined,
      create: toAdd.map((userId) => ({ userId })),
    };
  }

  if (data.status && data.status !== oldTask.status) {
    const done = data.status === "DONE";
    data.doneAt = done ? new Date() : null;
    data.doneBy = done
      ? { connect: { id: ctx.user.userId } }
      : { disconnect: true };
  }
  const task = await prisma.task.update({
    where: { id },
    data,
    include: {
      apartment: true,
      steps: true,
      assignedTo: {
        include: { user: { select: { id: true, name: true } } },
      },
    },
  });

  await logAudit({
    userId: ctx.user.userId,
    taskId: id,
    action: "TASK_EDITED",
    oldValue: oldTask,
    newValue: task,
  });

  if (assignedToUserIds !== undefined) {
    await logAudit({
      userId: ctx.user.userId,
      taskId: id,
      action: "TASK_ASSIGNED",
      newValue: { assignedToUserIds },
    });
  }

  return NextResponse.json({
    task: { ...task, assignedTo: task.assignedTo.map((a) => a.user) },
  });
});

export const DELETE = withRole([Role.COORDINATOR], async (_req, ctx) => {
  const id = ctx.params?.id as string;
  const task = await prisma.task.findUnique({
    where: { id },
    include: { apartment: true },
  });
  if (!task) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.task.delete({ where: { id } });
  await logAudit({
    userId: ctx.user.userId,
    action: "TASK_DELETED",
    oldValue: task,
  });

  return NextResponse.json({ ok: true });
});
