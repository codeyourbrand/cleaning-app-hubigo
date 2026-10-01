import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { verifySession } from "@/lib/auth";

export const dynamic = "force-dynamic";

const contentTypes: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".heic": "image/heic",
};

function getUploadDir(): string {
  const dir = process.env.LOCAL_UPLOAD_DIR ?? "uploads";
  return path.isAbsolute(dir)
    ? dir
    : path.join(/*turbopackIgnore: true*/ process.cwd(), dir);
}

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

  const uploadDir = getUploadDir();
  const filePath = path.join(uploadDir, ...segments);
  if (!filePath.startsWith(uploadDir + path.sep)) {
    return NextResponse.json({ error: "Invalid path" }, { status: 400 });
  }

  let data: Buffer;
  try {
    data = await fs.readFile(filePath);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    throw err;
  }

  const contentType =
    contentTypes[path.extname(filePath).toLowerCase()] ??
    "application/octet-stream";

  return new NextResponse(new Uint8Array(data), {
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "private, max-age=31536000, immutable",
    },
  });
}
