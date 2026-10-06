-- CreateTable
CREATE TABLE "cleaner_shifts" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "start_time" TEXT,
    "end_time" TEXT,
    "day_off" BOOLEAN NOT NULL DEFAULT false,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cleaner_shifts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "schedule_notes" (
    "id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "note" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "schedule_notes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "cleaner_shifts_date_idx" ON "cleaner_shifts"("date");

-- CreateIndex
CREATE UNIQUE INDEX "cleaner_shifts_user_id_date_key" ON "cleaner_shifts"("user_id", "date");

-- CreateIndex
CREATE INDEX "schedule_notes_date_idx" ON "schedule_notes"("date");

-- AddForeignKey
ALTER TABLE "cleaner_shifts" ADD CONSTRAINT "cleaner_shifts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
