import { NextRequest, NextResponse } from "next/server";
import {
  handleHostfullyWebhook,
  verifyWebhookToken,
  verifyAgency,
} from "@/lib/integrations/hostfully/webhook";
import { HostfullyWebhookPayload } from "@/lib/integrations/hostfully/client";

export async function POST(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  const check = verifyWebhookToken(token);
  if (!check.ok) {
    return NextResponse.json({ error: check.error }, { status: check.status });
  }

  let payload: HostfullyWebhookPayload;
  const contentType = req.headers.get("content-type") ?? "";
  try {
    if (contentType.includes("application/x-www-form-urlencoded")) {
      const params = new URLSearchParams(await req.text());
      payload = Object.fromEntries(
        params,
      ) as unknown as HostfullyWebhookPayload;
    } else {
      payload = (await req.json()) as HostfullyWebhookPayload;
    }
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  if (!payload?.event_type || !payload?.agency_uid) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }
  if (!verifyAgency(payload)) {
    return NextResponse.json({ error: "Wrong agency" }, { status: 400 });
  }

  try {
    await handleHostfullyWebhook(payload);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Hostfully webhook error", err);
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 500 },
    );
  }
}
