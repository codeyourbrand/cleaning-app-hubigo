import { NextResponse } from "next/server";
import { withRole } from "@/lib/api";
import { Role } from "@prisma/client";
import QRCode from "qrcode";

export const GET = withRole([Role.COORDINATOR], async (_req, ctx) => {
  const id = ctx.params?.id as string;
  const url = `${process.env.NEXT_PUBLIC_APP_URL}/apartments/${id}/today`;
  const dataUrl = await QRCode.toDataURL(url, { width: 400, margin: 2 });
  return NextResponse.json({ dataUrl, url });
});
