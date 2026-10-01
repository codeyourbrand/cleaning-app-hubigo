import { NextRequest, NextResponse } from "next/server";
import { withRole } from "@/lib/api";
import { sendPushNotification } from "@/lib/notifications";
import { Role } from "@prisma/client";

export const POST = withRole([Role.COORDINATOR], async (req: NextRequest) => {
  const { userId, title, body, url } = await req.json();
  await sendPushNotification(userId, title || "Hubigo", body || "", url);
  return NextResponse.json({ ok: true });
});
