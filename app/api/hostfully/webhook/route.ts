import { NextRequest, NextResponse } from "next/server";
import { handleHostfullyWebhook, verifyHostfullyWebhook } from "@/lib/integrations/hostfully/webhook";

export async function POST(req: NextRequest) {
  const bodyText = await req.text();
  const signature = req.headers.get("x-hostfully-signature") ?? undefined;

  if (!verifyHostfullyWebhook(bodyText, signature)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let payload;
  try {
    payload = JSON.parse(bodyText);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  try {
    await handleHostfullyWebhook(payload);
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("Hostfully webhook error", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
