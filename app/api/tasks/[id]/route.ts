import { NextRequest, NextResponse } from "next/server";
import { withRole } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { taskUpdateSchema } from "@/lib/schemas";
import { Role } from "@prisma/client";
import { logAudit } from "@/lib/audit";
import {
  sendWhatsAppNotification,
  buildTaskAssignedMessage,
} from "@/lib/whatsapp";

export const GET = withRole(
  [Role.CLEANER, Role.COORDINATOR],
  async (_req, ctx) => {
    const id = ctx.params?.id as string;
    const task = await prisma.task.findUnique({
      where: { id },
      include: {
        apartment: true,
        assignedTo: { select: { id: true, name: true, avatarUrl: true } },
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
    return NextResponse.json({ task });
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

  const oldTask = await prisma.task.findUnique({ where: { id } });
  if (!oldTask) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const data: any = { ...parsed.data };
  if (data.status && data.status !== oldTask.status) {
    const done = data.status === "DONE";
    data.doneAt = done ? new Date() : null;
    data.doneByUserId = done ? ctx.user.userId : null;
  }
  const task = await prisma.task.update({
    where: { id },
    data,
    include: { apartment: true, steps: true },
  });

  await logAudit({
    userId: ctx.user.userId,
    taskId: id,
    action: "TASK_EDITED",
    oldValue: oldTask,
    newValue: task,
  });

  // WhatsApp notification when someone gets assigned
  if (
    data.assignedToUserId &&
    data.assignedToUserId !== oldTask.assignedToUserId
  ) {
    const fullTask = await prisma.task.findUnique({
      where: { id },
      include: {
        apartment: true,
        assignedTo: { select: { name: true, phone: true } },
      },
    });
    if (fullTask) {
      sendWhatsAppNotification(
        "TASK_ASSIGNED",
        buildTaskAssignedMessage(fullTask),
        {
          actorUserId: ctx.user.userId,
          taskId: id,
          recipient: fullTask.assignedTo,
        },
      ).catch(() => {});
    }
  }

  return NextResponse.json({ task });
});

export const DELETE = withRole([Role.COORDINATOR], async (_req, ctx) => {
  const id = ctx.params?.id as string;
  await prisma.task.delete({ where: { id } });
  return NextResponse.json({ ok: true });
});
