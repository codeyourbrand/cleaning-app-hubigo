import { NextRequest, NextResponse } from "next/server";
import { otpRequestSchema } from "@/lib/schemas";
import { sendOtp } from "@/lib/otp";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const parsed = otpRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", issues: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }
  const { email, phone } = parsed.data;
  const identifier = email ?? phone;
  if (!identifier) {
    return NextResponse.json(
      { error: "Email or phone is required" },
      { status: 400 }
    );
  }

  const result = await sendOtp(identifier);
  if (!result.sent) {
    return NextResponse.json(
      { error: "Could not send code. SMS provider not configured." },
      { status: 503 }
    );
  }

  return NextResponse.json({
    ok: true,
    // Code is returned only in development for testing convenience
    code: process.env.NODE_ENV !== "production" ? result.code : undefined,
  });
}
