import { NextRequest, NextResponse } from "next/server";
import { withRole } from "@/lib/api";
import { syncHostfully } from "@/lib/integrations/hostfully/sync";
import { Role } from "@prisma/client";
import { parseISO } from "date-fns";

export const POST = withRole([Role.COORDINATOR], async (req: NextRequest) => {
  let since: Date | undefined;
  try {
    const body = await req.json();
    if (body.since) {
      since = parseISO(body.since);
    }
  } catch {
    // ignore optional body
  }
  const result = await syncHostfully(since);
  return NextResponse.json(result);
});
