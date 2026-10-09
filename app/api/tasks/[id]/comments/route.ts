import { NextRequest, NextResponse } from "next/server";
import { withRole } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { commentSchema } from "@/lib/schemas";
import { Role } from "@prisma/client";
import { logAudit } from "@/lib/audit";
import {
  sendWhatsAppNotification,
  buildTaskCommentedMessage,
} from "@/lib/whatsapp";

export const GET = withRole(
  [Role.CLEANER, Role.COORDINATOR],
  async (_req, ctx) => {
    const taskId = ctx.params?.id as string;
    const comments = await prisma.comment.findMany({
      where: { taskId, parentId: null },
      orderBy: { createdAt: "asc" },
      include: {
        author: { select: { id: true, name: true, avatarUrl: true } },
        media: true,
        replies: {
          orderBy: { createdAt: "asc" },
          include: {
            author: { select: { id: true, name: true, avatarUrl: true } },
            media: true,
          },
        },
      },
    });
    return NextResponse.json({ comments });
  },
);

export const POST = withRole(
  [Role.CLEANER, Role.COORDINATOR],
  async (req: NextRequest, ctx) => {
    const body = await req.json();
    const parsed = commentSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", issues: parsed.error.flatten().fieldErrors },
        { status: 400 },
      );
    }

    const { taskId, parentId, body: commentBody } = parsed.data;

    // Ensure the taskId matches route
    if (taskId !== (ctx.params?.id as string)) {
      return NextResponse.json({ error: "Task mismatch" }, { status: 400 });
    }

    const comment = await prisma.comment.create({
      data: {
        taskId,
        parentId,
        authorUserId: ctx.user.userId,
        body: commentBody,
      },
      include: {
        author: { select: { id: true, name: true, avatarUrl: true } },
        media: true,
      },
    });

    await logAudit({
      userId: ctx.user.userId,
      taskId,
      action: "COMMENT_CREATED",
      newValue: { id: comment.id, parentId, body: commentBody },
    });

    // A coordinator's comment goes to the assigned cleaner; a cleaner's comment
    // can only reach the group. Fire-and-forget, off unless enabled in settings.
    const task = await prisma.task.findUnique({
      where: { id: taskId },
      include: {
        apartment: true,
        assignedTo: { select: { id: true, name: true, phone: true } },
      },
    });
    if (task) {
      const recipient =
        ctx.user.role === Role.COORDINATOR &&
        task.assignedTo?.id !== ctx.user.userId
          ? task.assignedTo
          : null;
      sendWhatsAppNotification(
        "TASK_COMMENTED",
        buildTaskCommentedMessage(task, ctx.user.name, commentBody),
        recipient
          ? { recipient, actorUserId: ctx.user.userId, taskId }
          : undefined,
      ).catch(() => {});
    }

    return NextResponse.json({ comment }, { status: 201 });
  },
);
