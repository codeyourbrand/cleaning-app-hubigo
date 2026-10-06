import { NextRequest, NextResponse } from "next/server";
import { withRole } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { Role } from "@prisma/client";
import { getAuditActionsByCategory, type AuditCategory } from "@/lib/audit";

export const GET = withRole([Role.COORDINATOR], async (req) => {
  const { searchParams } = new URL(req.url);
  const category = searchParams.get("category") as AuditCategory | null;
  const search = searchParams.get("search");
  const sortDir = searchParams.get("sortDir") === "asc" ? "asc" : "desc";
  const limit = Math.min(parseInt(searchParams.get("limit") || "200"), 1000);
  const offset = parseInt(searchParams.get("offset") || "0");

  const where: any = {};

  if (category && category !== "OTHER") {
    const actions = getAuditActionsByCategory(category);
    if (actions.length > 0) {
      where.action = { in: actions };
    }
  } else if (category === "OTHER") {
    // Everything that's not in known categories
    const knownActions = [
      ...getAuditActionsByCategory("TASK"),
      ...getAuditActionsByCategory("INVENTORY"),
      ...getAuditActionsByCategory("SYNC"),
    ];
    where.action = { notIn: knownActions };
  }

  if (search) {
    where.OR = [
      { action: { contains: search, mode: "insensitive" } },
      { user: { name: { contains: search, mode: "insensitive" } } },
      { newValue: { contains: search, mode: "insensitive" } },
      { oldValue: { contains: search, mode: "insensitive" } },
    ];
  }

  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: sortDir },
      skip: offset,
      take: limit,
      include: {
        user: { select: { id: true, name: true } },
        task: {
          select: {
            id: true,
            title: true,
            type: true,
            apartment: { select: { number: true } },
          },
        },
      },
    }),
    prisma.auditLog.count({ where }),
  ]);

  return NextResponse.json({ logs, total });
});
