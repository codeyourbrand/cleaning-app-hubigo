import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/api";
import { savePushSubscription } from "@/lib/notifications";

export const POST = withAuth(async (req, ctx) => {
  const body = await req.json();
  await savePushSubscription(ctx.user.userId, body.subscription);
  return NextResponse.json({ ok: true });
});
