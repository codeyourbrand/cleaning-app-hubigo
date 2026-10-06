import { NextResponse } from "next/server";
import { withRole } from "@/lib/api";
import { Role } from "@prisma/client";
import { isWhatsAppConfigured, sendWhatsAppTestMessage } from "@/lib/whatsapp";

export const POST = withRole([Role.COORDINATOR], async () => {
  if (!isWhatsAppConfigured()) {
    return NextResponse.json(
      { error: "WhatsApp integration not configured. Set WHAPI_TOKEN and WHAPI_GROUP_ID." },
      { status: 400 },
    );
  }

  const sent = await sendWhatsAppTestMessage(
    "✅ *Test* — WhatsApp notifications are working!\nSent from Hubigo Cleaning App",
  );

  if (!sent) {
    return NextResponse.json(
      { error: "Failed to send test message. Check WHAPI_TOKEN and WHAPI_GROUP_ID." },
      { status: 502 },
    );
  }

  return NextResponse.json({ ok: true });
});
