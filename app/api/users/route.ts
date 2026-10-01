import { NextRequest, NextResponse } from "next/server";
import { withRole } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { userCreateSchema } from "@/lib/schemas";
import { Role } from "@prisma/client";
import { hashPassword } from "@/lib/auth";
import { logAudit } from "@/lib/audit";

export const GET = withRole([Role.COORDINATOR], async () => {
  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
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
  return NextResponse.json({ users });
});

export const POST = withRole([Role.COORDINATOR], async (req, ctx) => {
  const body = await req.json();
  const parsed = userCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", issues: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const { name, email, phone, role, password, active } = parsed.data;
  if (!email && !phone) {
    return NextResponse.json(
      { error: "Email or phone is required" },
      { status: 400 }
    );
  }

  const passwordHash = await hashPassword(password);

  try {
    const user = await prisma.user.create({
      data: {
        name,
        email,
        phone,
        role,
        passwordHash,
        active,
      },
    });
    await logAudit({
      userId: ctx.user.userId,
      action: "USER_CREATED",
      newValue: { id: user.id, name, role },
    });
    return NextResponse.json(
      {
        user: {
          id: user.id,
          name: user.name,
          role: user.role,
          email: user.email,
          phone: user.phone,
          active: user.active,
          createdAt: user.createdAt,
        },
      },
      { status: 201 }
    );
  } catch (err: any) {
    if (err.code === "P2002") {
      return NextResponse.json(
        { error: "User with this email or phone already exists" },
        { status: 409 }
      );
    }
    throw err;
  }
});
