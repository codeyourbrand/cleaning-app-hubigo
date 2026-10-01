import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  verifyPassword,
  createSession,
  checkRateLimit,
} from "@/lib/auth";
import { loginSchema } from "@/lib/schemas";
import { getClientIp } from "@/lib/ip";

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  const limit = checkRateLimit(`login:${ip}`);
  if (!limit.ok) {
    return NextResponse.json(
      { error: "Too many attempts. Try again later.", retryAfter: limit.retryAfter },
      { status: 429 }
    );
  }

  const body = await req.json();
  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", issues: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const { email, phone, password, rememberMe } = parsed.data;

  if (!email && !phone) {
    return NextResponse.json(
      { error: "Email or phone is required" },
      { status: 400 }
    );
  }

  const where = email ? { email } : { phone };
  const user = await prisma.user.findFirst({ where });
  if (!user || !user.active) {
    return NextResponse.json(
      { error: "Invalid credentials" },
      { status: 401 }
    );
  }

  const valid = await verifyPassword(user.passwordHash, password);
  if (!valid) {
    return NextResponse.json(
      { error: "Invalid credentials" },
      { status: 401 }
    );
  }

  await createSession(
    {
      userId: user.id,
      role: user.role,
      name: user.name,
      email: user.email,
      phone: user.phone,
    },
    rememberMe
  );

  return NextResponse.json({
    user: {
      id: user.id,
      name: user.name,
      role: user.role,
      email: user.email,
      phone: user.phone,
    },
  });
}
