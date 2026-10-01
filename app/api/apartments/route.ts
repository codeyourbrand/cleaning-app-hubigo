import { NextRequest, NextResponse } from "next/server";
import { withRole, requireUser } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { apartmentSchema } from "@/lib/schemas";
import { Role } from "@prisma/client";
import { logAudit } from "@/lib/audit";

export const GET = withRole([Role.CLEANER, Role.COORDINATOR], async () => {
  const apartments = await prisma.apartment.findMany({
    orderBy: { number: "asc" },
  });
  return NextResponse.json({ apartments });
});

export const POST = withRole([Role.COORDINATOR], async (req, ctx) => {
  const body = await req.json();
  const parsed = apartmentSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", issues: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const {
    number,
    building,
    floor,
    notes,
    externalHostfullyId,
    externalPropertyId,
  } = parsed.data;

  try {
    const apartment = await prisma.apartment.create({
      data: {
        number,
        building,
        floor,
        notes,
        externalHostfullyId,
        externalPropertyId,
      },
    });
    await logAudit({
      userId: ctx.user.userId,
      action: "APARTMENT_CREATED",
      newValue: { id: apartment.id, number, building },
    });
    return NextResponse.json({ apartment }, { status: 201 });
  } catch (err: any) {
    if (err.code === "P2002") {
      return NextResponse.json(
        { error: "Apartment number already exists in this building" },
        { status: 409 },
      );
    }
    throw err;
  }
});
