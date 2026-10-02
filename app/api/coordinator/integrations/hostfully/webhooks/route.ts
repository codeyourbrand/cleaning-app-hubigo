import { NextResponse } from "next/server";
import { withRole } from "@/lib/api";
import { registerHostfullyWebhooks } from "@/lib/integrations/hostfully/sync";
import { Role } from "@prisma/client";

export const POST = withRole([Role.COORDINATOR], async () => {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  const secret = process.env.HOSTFULLY_WEBHOOK_SECRET;
  if (!appUrl?.startsWith("https://")) {
    return NextResponse.json(
      { error: "NEXT_PUBLIC_APP_URL must be set to the public https URL" },
      { status: 400 },
    );
  }
  if (!secret) {
    return NextResponse.json(
      { error: "HOSTFULLY_WEBHOOK_SECRET is not configured" },
      { status: 400 },
    );
  }

  const callbackUrl = `${appUrl}/api/hostfully/webhook?token=${encodeURIComponent(secret)}`;
  try {
    const result = await registerHostfullyWebhooks(callbackUrl);
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 500 },
    );
  }
});
