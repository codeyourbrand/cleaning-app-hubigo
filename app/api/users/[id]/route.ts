import { NextRequest, NextResponse } from "next/server";
import { withRole } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { userUpdateSchema } from "@/lib/schemas";
import { Role } from "@prisma/client";
import { logAudit } from "@/lib/audit";
import { hashPassword } from "@/lib/auth";

export const PATCH = withRole([Role.COORDINATOR], async (req, ctx) => {
  const id = ctx.params?.id as string;
  const body = await req.json();
  const parsed = userUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", issues: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const { password, ...updates } = parsed.data;
  const data = {
    ...updates,
    ...(password ? { passwordHash: await hashPassword(password) } : {}),
  };

  try {
    const user = await prisma.user.update({
      where: { id },
      data,
      select: {
        id: true,
        name: true,
        role: true,
        phone: true,
        email: true,
        avatarUrl: true,
        active: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    await logAudit({
      userId: ctx.user.userId,
      action: "USER_UPDATED",
      newValue: { ...updates, passwordChanged: Boolean(password) },
    });

    return NextResponse.json({ user });
  } catch (error: unknown) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "P2002"
    ) {
      return NextResponse.json(
        { error: "User with this email or phone already exists" },
        { status: 409 },
      );
    }
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "P2025"
    ) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }
    throw error;
  }
});
