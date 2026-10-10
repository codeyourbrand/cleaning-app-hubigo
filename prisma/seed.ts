import { PrismaClient, Role, TaskType, TaskStatus } from "@prisma/client";
import { hashPassword } from "../lib/password";

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await hashPassword("Hubigo123!");

  const coordinator = await prisma.user.upsert({
    where: { email: "coordinator@hubigo.local" },
    update: {},
    create: {
      name: "Coordinator Demo",
      email: "coordinator@hubigo.local",
      role: Role.COORDINATOR,
      passwordHash,
      active: true,
    },
  });

  const cleaner1 = await prisma.user.upsert({
    where: { email: "cleaner1@hubigo.local" },
    update: {},
    create: {
      name: "Ana Cleaner",
      email: "cleaner1@hubigo.local",
      phone: "+971500000001",
      role: Role.CLEANER,
      passwordHash,
      active: true,
    },
  });

  const cleaner2 = await prisma.user.upsert({
    where: { email: "cleaner2@hubigo.local" },
    update: {},
    create: {
      name: "Maria Cleaner",
      email: "cleaner2@hubigo.local",
      phone: "+971500000002",
      role: Role.CLEANER,
      passwordHash,
      active: true,
    },
  });

  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  async function upsertApartment(
    number: string,
    building: string,
    floor: string,
  ) {
    const existing = await prisma.apartment.findUnique({
      where: { apartment_number_building_unique: { number, building } },
    });
    if (existing) return existing;
    return prisma.apartment.create({ data: { number, building, floor } });
  }

  const apartments = await Promise.all([
    upsertApartment("157", "Marina Heights", "12"),
    upsertApartment("1003", "Downtown Views", "25"),
    upsertApartment("247", "Palm Residences", "3"),
  ]);

  const taskData = [
    {
      apartmentId: apartments[0].id,
      checkoutTime: "11:00",
      checkinWindow: "15:00–16:00",
      guestsCount: 4,
      nightsCount: 3,
      requests: "Luggage storage, baby equipment",
      instructions: "Prepare sofa bed, check balcony",
      assignedToUserId: cleaner1.id,
    },
    {
      apartmentId: apartments[1].id,
      checkoutTime: "10:30",
      checkinWindow: "14:00–15:00",
      guestsCount: 2,
      nightsCount: 5,
      requests: "Parking, extra towels",
      instructions: "Leave extra towels, inspect AC",
      assignedToUserId: cleaner2.id,
    },
    {
      apartmentId: apartments[2].id,
      checkoutTime: "12:00",
      checkinWindow: "16:00–17:00",
      guestsCount: 6,
      nightsCount: 2,
      requests: "Early check-in request",
      instructions: "Focus on kitchen, replace shower gel",
      assignedToUserId: cleaner1.id,
    },
  ];

  const steps = [
    "Kitchen",
    "Bathroom",
    "Bedrooms",
    "Living room",
    "Floors",
    "Final inspection",
  ];

  for (let i = 0; i < taskData.length; i++) {
    const data = taskData[i];
    await prisma.task.upsert({
      where: {
        externalHostfullyReservationId: `seed-${data.apartmentId}-${today.toISOString().split("T")[0]}`,
      },
      update: {},
      create: {
        date: today,
        apartmentId: data.apartmentId,
        type: TaskType.CLEANING,
        status: TaskStatus.TODO,
        checkoutTime: data.checkoutTime,
        checkinWindow: data.checkinWindow,
        guestsCount: data.guestsCount,
        nightsCount: data.nightsCount,
        requests: data.requests,
        instructions: data.instructions,
        createdByUserId: coordinator.id,
        externalHostfullyReservationId: `seed-${data.apartmentId}-${today.toISOString().split("T")[0]}`,
        assignedTo: { create: { userId: data.assignedToUserId } },
        steps: {
          create: steps.map((name, idx) => ({ name, order: idx })),
        },
      },
    });
  }

  console.log("Seeded users, apartments, and tasks.");
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
