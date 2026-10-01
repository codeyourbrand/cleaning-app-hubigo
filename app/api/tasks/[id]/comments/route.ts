import { NextRequest, NextResponse } from "next/server";
import { withRole } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { commentSchema } from "@/lib/schemas";
import { Role } from "@prisma/client";
import { logAudit } from "@/lib/audit";

export const GET = withRole([Role.CLEANER, Role.COORDINATOR], async (_req, ctx) => {
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
});

export const POST = withRole([Role.CLEANER, Role.COORDINATOR], async (req: NextRequest, ctx) => {
  const body = await req.json();
  const parsed = commentSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", issues: parsed.error.flatten().fieldErrors },
      { status: 400 }
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

  return NextResponse.json({ comment }, { status: 201 });
});
