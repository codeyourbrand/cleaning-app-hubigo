import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSession, checkRateLimit } from "@/lib/auth";
import { otpVerifySchema } from "@/lib/schemas";
import { verifyOtp } from "@/lib/otp";
import { getClientIp } from "@/lib/ip";

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  const limit = checkRateLimit(`otp:${ip}`);
  if (!limit.ok) {
    return NextResponse.json(
      { error: "Too many attempts. Try again later.", retryAfter: limit.retryAfter },
      { status: 429 }
    );
  }

  const body = await req.json();
  const parsed = otpVerifySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", issues: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const { email, phone, code, rememberMe } = parsed.data;
  const identifier = email ?? phone;
  if (!identifier) {
    return NextResponse.json(
      { error: "Email or phone is required" },
      { status: 400 }
    );
  }

  if (!verifyOtp(identifier, code)) {
    return NextResponse.json(
      { error: "Invalid or expired code" },
      { status: 401 }
    );
  }

  const where = email ? { email } : { phone };
  const user = await prisma.user.findFirst({ where });
  if (!user || !user.active) {
    return NextResponse.json(
      { error: "User not found" },
      { status: 404 }
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
