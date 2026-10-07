import { NextRequest, NextResponse } from "next/server";
import path from "path";
import { verifySession } from "@/lib/auth";
import { getStorageProvider } from "@/lib/storage";

export const dynamic = "force-dynamic";

const contentTypes: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".heic": "image/heic",
};

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const session = await verifySession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { path: segments } = await params;
  if (
    !segments.length ||
    segments.some((s) => s.includes("..") || !/^[a-zA-Z0-9._-]+$/.test(s))
  ) {
    return NextResponse.json({ error: "Invalid path" }, { status: 400 });
  }

  const data = await getStorageProvider().get(segments.join("/"));
  if (!data) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const contentType =
    contentTypes[path.extname(segments[segments.length - 1]).toLowerCase()] ??
    "application/octet-stream";

  return new NextResponse(new Uint8Array(data), {
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "private, max-age=31536000, immutable",
    },
  });
}
