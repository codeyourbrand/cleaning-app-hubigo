import { NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { withRole } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { getTaskNotifyState } from "@/lib/task-notify";
import {
  sendWhatsAppNotification,
  buildTaskAssignedMessage,
  buildTaskTimingChangedMessage,
} from "@/lib/whatsapp";

/**
 * POST /api/tasks/:id/whatsapp[?resend=true]
 *
 * Coordinator "accepts" the plan for a task: the assigned cleaner gets a
 * WhatsApp message - the assignment on first send, or a TIMING CHANGED notice
 * when the time was edited after the previous send.
 */
export const POST = withRole([Role.COORDINATOR], async (req, ctx) => {
  const id = ctx.params?.id as string;
  const resend = new URL(req.url).searchParams.get("resend") === "true";

  const task = await prisma.task.findUnique({
    where: { id },
    include: {
      apartment: true,
      assignedTo: { select: { id: true, name: true, phone: true } },
    },
  });
  if (!task) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const state = getTaskNotifyState(task);
  if (state === "NO_ASSIGNEE" || !task.assignedTo) {
    return NextResponse.json(
      { error: "Assign a cleaner first" },
      { status: 409 },
    );
  }
  if (state === "SENT" && !resend) {
    return NextResponse.json({ kind: "UP_TO_DATE" });
  }
  if (!task.assignedTo.phone) {
    return NextResponse.json(
      { error: `${task.assignedTo.name} has no phone number` },
      { status: 422 },
    );
  }

  const timingChanged = state === "TIMING_CHANGED";
  const sent = await sendWhatsAppNotification(
    timingChanged ? "TASK_TIMING_CHANGED" : "TASK_ASSIGNED",
    timingChanged
      ? buildTaskTimingChangedMessage(task, task.whatsappSentCheckoutTime)
      : buildTaskAssignedMessage(task),
    {
      recipient: task.assignedTo,
      actorUserId: ctx.user.userId,
      taskId: id,
    },
  );
  if (!sent) {
    return NextResponse.json(
      {
        error:
          "WhatsApp message was not sent. Check the notification settings and the Whapi configuration.",
      },
      { status: 502 },
    );
  }

  await prisma.task.update({
    where: { id },
    data: {
      whatsappSentAt: new Date(),
      whatsappSentToUserId: task.assignedTo.id,
      whatsappSentCheckoutTime: task.checkoutTime,
    },
  });
  const kind = timingChanged ? "TIMING_CHANGED" : "ASSIGNED";
  await logAudit({
    userId: ctx.user.userId,
    taskId: id,
    action: "WHATSAPP_SENT",
    newValue: {
      kind,
      recipient: task.assignedTo.name,
      checkoutTime: task.checkoutTime,
    },
  });

  return NextResponse.json({ kind });
});
