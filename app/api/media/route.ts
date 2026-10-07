import { NextRequest, NextResponse } from "next/server";
import { withRole } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { getStorageProvider } from "@/lib/storage";
import { Role, MediaType } from "@prisma/client";
import { logAudit } from "@/lib/audit";

const allowedTypes = new Set(["BEFORE", "AFTER", "COMMENT"]);

export const POST = withRole(
  [Role.CLEANER, Role.COORDINATOR],
  async (req, ctx) => {
    const form = await req.formData();
    const file = form.get("file") as File | null;
    const taskId = form.get("taskId") as string | null;
    const commentId = form.get("commentId") as string | null;
    const type = form.get("type") as string | null;

    if (!file || !type || !allowedTypes.has(type)) {
      return NextResponse.json(
        { error: "Invalid upload parameters" },
        { status: 400 },
      );
    }

    if (commentId && !taskId) {
      return NextResponse.json(
        { error: "Task ID is required for comment media" },
        { status: 400 },
      );
    }

    const bytes = Buffer.from(await file.arrayBuffer());
    const storage = getStorageProvider();
    const stored = await storage.put(bytes, file.name, file.type);

    const media = await prisma.media.create({
      data: {
        taskId: taskId ?? undefined,
        commentId: commentId ?? undefined,
        type: type as MediaType,
        url: stored.url,
        addedByUserId: ctx.user.userId,
      },
    });

    await logAudit({
      userId: ctx.user.userId,
      taskId: taskId ?? undefined,
      action: "PHOTO_ADDED",
      newValue: { mediaId: media.id, type, url: stored.url },
    });

    return NextResponse.json({ media }, { status: 201 });
  },
);
