import { NextRequest, NextResponse } from "next/server";
import { withRole } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { damageSchema } from "@/lib/schemas";
import { Role } from "@prisma/client";
import { logAudit } from "@/lib/audit";

export const POST = withRole([Role.CLEANER, Role.COORDINATOR], async (req: NextRequest, ctx) => {
  const body = await req.json();
  const parsed = damageSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", issues: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const { apartmentId, description, photoUrl } = parsed.data;
  const item = await prisma.damage.create({
    data: {
      apartmentId,
      reportedByUserId: ctx.user.userId,
      description,
      photoUrl,
    },
    include: {
      reportedBy: { select: { id: true, name: true } },
      apartment: { select: { id: true, number: true } },
    },
  });

  await logAudit({
    userId: ctx.user.userId,
    action: "DAMAGE_CREATED",
    newValue: { id: item.id, apartmentId, description },
  });

  return NextResponse.json({ item }, { status: 201 });
});
