import { NextRequest, NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { verifySession, SessionPayload } from "./auth";
import { prisma } from "./prisma";

type ApiContext = {
  user: SessionPayload;
  params?: Record<string, string | string[]>;
};
type ApiHandler = (req: NextRequest, ctx: ApiContext) => Promise<Response>;

export function withAuth(
  handler: ApiHandler,
): (
  req: NextRequest,
  { params }: { params?: Promise<Record<string, string | string[]>> },
) => Promise<Response> {
  return async (req, { params }) => {
    const user = await verifySession();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const resolvedParams = params ? await params : undefined;
    return handler(req, { user, params: resolvedParams });
  };
}

export function withRole(
  roles: Role[],
  handler: ApiHandler,
): (
  req: NextRequest,
  { params }: { params?: Promise<Record<string, string | string[]>> },
) => Promise<Response> {
  return withAuth(async (req, ctx) => {
    if (!roles.includes(ctx.user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return handler(req, ctx);
  });
}

export async function requireUser(session: SessionPayload) {
  const user = await prisma.user.findUnique({ where: { id: session.userId } });
  if (!user || !user.active) {
    throw new Error("Unauthorized");
  }
  return user;
}
