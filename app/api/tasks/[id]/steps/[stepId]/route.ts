import { NextResponse } from "next/server";
import { withRole } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { taskStepUpdateSchema } from "@/lib/schemas";
import { Role } from "@prisma/client";
import { logAudit } from "@/lib/audit";

export const PATCH = withRole(
  [Role.CLEANER, Role.COORDINATOR],
  async (req, ctx) => {
    const taskId = ctx.params?.id as string;
    const stepId = ctx.params?.stepId as string;
    const body = await req.json();
    const parsed = taskStepUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", issues: parsed.error.flatten().fieldErrors },
        { status: 400 },
      );
    }

    const task = await prisma.task.findUnique({
      where: { id: taskId },
      include: { assignedTo: { select: { userId: true } } },
    });
    if (!task) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    const assignedUserIds = task.assignedTo.map((a) => a.userId);
    if (
      ctx.user.role === Role.CLEANER &&
      assignedUserIds.length > 0 &&
      !assignedUserIds.includes(ctx.user.userId)
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { done } = parsed.data;
    const now = new Date();
    const step = await prisma.taskStep.update({
      where: { id: stepId, taskId },
      data: {
        done,
        doneAt: done ? now : null,
        doneByUserId: done ? ctx.user.userId : null,
      },
    });

    await logAudit({
      userId: ctx.user.userId,
      taskId,
      action: done ? "STEP_COMPLETED" : "STEP_UNCOMPLETED",
      newValue: { stepId, done },
    });

    return NextResponse.json({ step });
  },
);
