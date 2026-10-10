import { NextResponse } from "next/server";
import { withRole } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { Role, TaskStatus } from "@prisma/client";
import { logAudit } from "@/lib/audit";
import {
  sendWhatsAppNotification,
  buildTaskCompletedMessage,
} from "@/lib/whatsapp";

export const POST = withRole(
  [Role.CLEANER, Role.COORDINATOR],
  async (_req, ctx) => {
    const id = ctx.params?.id as string;
    const task = await prisma.task.findUnique({
      where: { id },
      include: { assignedTo: { select: { userId: true } } },
    });
    if (!task) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const assignedUserIds = task.assignedTo.map((a) => a.userId);
    if (
      ctx.user.role === Role.CLEANER &&
      assignedUserIds.length > 0 &&
      !assignedUserIds.includes(ctx.user.userId)
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (task.status === TaskStatus.DONE) {
      return NextResponse.json(
        { error: "Task already completed" },
        { status: 409 },
      );
    }

    const now = new Date();
    const updated = await prisma.task.update({
      where: { id },
      data: {
        status: TaskStatus.DONE,
        doneAt: now,
        doneByUserId: ctx.user.userId,
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
      action: "TASK_COMPLETED",
      oldValue: { status: task.status },
      newValue: { status: updated.status, doneAt: now },
    });

    // WhatsApp notification
    const doneUser = await prisma.user.findUnique({
      where: { id: ctx.user.userId },
      select: { name: true, phone: true },
    });
    sendWhatsAppNotification(
      "TASK_COMPLETED",
      buildTaskCompletedMessage({ ...updated, doneBy: doneUser }),
      { actorUserId: ctx.user.userId, taskId: id, recipient: doneUser },
    ).catch(() => {});

    return NextResponse.json({
      task: { ...updated, assignedTo: updated.assignedTo.map((a) => a.user) },
    });
  },
);
