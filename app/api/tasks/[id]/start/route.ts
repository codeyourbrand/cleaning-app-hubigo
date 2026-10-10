import { NextResponse } from "next/server";
import { withRole } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { Role, TaskStatus } from "@prisma/client";
import { logAudit } from "@/lib/audit";
import {
  sendWhatsAppNotification,
  buildTaskStartedMessage,
} from "@/lib/whatsapp";

export const POST = withRole(
  [Role.CLEANER, Role.COORDINATOR],
  async (_req, ctx) => {
    const id = ctx.params?.id as string;
    const task = await prisma.task.findUnique({
      where: { id },
      include: {
        assignedTo: {
          select: { userId: true },
        },
      },
    });
    if (!task) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // Cleaners can only start their own assigned tasks unless explicitly permitted
    const assignedUserIds = task.assignedTo.map((a) => a.userId);
    if (
      ctx.user.role === Role.CLEANER &&
      assignedUserIds.length > 0 &&
      !assignedUserIds.includes(ctx.user.userId)
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (
      task.status !== TaskStatus.TODO &&
      task.status !== TaskStatus.IN_PROGRESS
    ) {
      return NextResponse.json(
        { error: "Task cannot be started" },
        { status: 409 },
      );
    }

    const now = new Date();
    const updated = await prisma.task.update({
      where: { id },
      data: {
        status: TaskStatus.IN_PROGRESS,
        startedAt: now,
        startedByUserId: ctx.user.userId,
      },
      include: {
        apartment: true,
        assignedTo: {
          include: {
            user: { select: { id: true, name: true, avatarUrl: true } },
          },
        },
      },
    });

    await logAudit({
      userId: ctx.user.userId,
      taskId: id,
      action: "TASK_STARTED",
      oldValue: { status: task.status },
      newValue: { status: updated.status, startedAt: now },
    });

    // WhatsApp notification
    const startedUser = await prisma.user.findUnique({
      where: { id: ctx.user.userId },
      select: { name: true, phone: true },
    });
    sendWhatsAppNotification(
      "TASK_STARTED",
      buildTaskStartedMessage({
        ...updated,
        startedBy: startedUser,
      }),
      { actorUserId: ctx.user.userId, taskId: id, recipient: startedUser },
    ).catch(() => {});

    return NextResponse.json({
      task: { ...updated, assignedTo: updated.assignedTo.map((a) => a.user) },
    });
  },
);
