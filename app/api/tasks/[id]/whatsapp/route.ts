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
 * Coordinator "accepts" the plan for a task: every assigned cleaner that has
 * not yet been notified (or whose checkout time changed) gets a WhatsApp
 * message. The state is tracked per assignee in TaskAssignedCleaner.
 */
export const POST = withRole([Role.COORDINATOR], async (req, ctx) => {
  const id = ctx.params?.id as string;
  const resend = new URL(req.url).searchParams.get("resend") === "true";

  const task = await prisma.task.findUnique({
    where: { id },
    include: {
      apartment: true,
      assignedTo: {
        include: {
          user: { select: { id: true, name: true, phone: true } },
        },
      },
    },
  });
  if (!task) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const state = getTaskNotifyState({
    assignedTo: task.assignedTo.map((a) => ({
      id: a.userId,
      whatsappSentAt: a.whatsappSentAt,
      whatsappSentCheckoutTime: a.whatsappSentCheckoutTime,
    })),
    checkoutTime: task.checkoutTime,
  });

  if (state === "NO_ASSIGNEE" || task.assignedTo.length === 0) {
    return NextResponse.json(
      { error: "Assign a cleaner first" },
      { status: 409 },
    );
  }

  if (state === "SENT" && !resend) {
    return NextResponse.json({ kind: "UP_TO_DATE" });
  }

  const recipients = task.assignedTo.filter((a) => {
    if (resend) return true;
    return (
      !a.whatsappSentAt || a.whatsappSentCheckoutTime !== task.checkoutTime
    );
  });

  if (recipients.length === 0) {
    return NextResponse.json({ kind: "UP_TO_DATE" });
  }

  const timingChanged = state === "TIMING_CHANGED";
  const sentNames: string[] = [];

  for (const assignment of recipients) {
    if (!assignment.user.phone) continue;

    const message = timingChanged
      ? buildTaskTimingChangedMessage(task, assignment.whatsappSentCheckoutTime)
      : buildTaskAssignedMessage({
          ...task,
          assignedTo: assignment.user,
        });
    const sent = await sendWhatsAppNotification(
      timingChanged ? "TASK_TIMING_CHANGED" : "TASK_ASSIGNED",
      message,
      {
        recipient: assignment.user,
        actorUserId: ctx.user.userId,
        taskId: id,
      },
    );

    if (sent) {
      sentNames.push(assignment.user.name);
      await prisma.taskAssignedCleaner.update({
        where: { id: assignment.id },
        data: {
          whatsappSentAt: new Date(),
          whatsappSentCheckoutTime: task.checkoutTime,
        },
      });
    }
  }

  if (sentNames.length === 0) {
    return NextResponse.json(
      {
        error:
          "WhatsApp message was not sent. Check the notification settings, the Whapi configuration, and that the cleaners have phone numbers.",
      },
      { status: 502 },
    );
  }

  const kind = timingChanged ? "TIMING_CHANGED" : "ASSIGNED";
  await logAudit({
    userId: ctx.user.userId,
    taskId: id,
    action: "WHATSAPP_SENT",
    newValue: {
      kind,
      recipients: sentNames,
      checkoutTime: task.checkoutTime,
    },
  });

  return NextResponse.json({ kind, recipients: sentNames });
});
