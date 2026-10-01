import { NextRequest, NextResponse } from "next/server";
import { withRole } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { userUpdateSchema } from "@/lib/schemas";
import { Role } from "@prisma/client";
import { logAudit } from "@/lib/audit";

export const PATCH = withRole([Role.COORDINATOR], async (req, ctx) => {
  const id = ctx.params?.id as string;
  const body = await req.json();
  const parsed = userUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", issues: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const user = await prisma.user.update({
    where: { id },
    data: parsed.data,
  });

  await logAudit({
    userId: ctx.user.userId,
    action: "USER_UPDATED",
    newValue: parsed.data,
  });

  return NextResponse.json({ user });
});
