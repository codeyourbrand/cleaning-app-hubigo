-- AlterTable
ALTER TABLE "schedule_notes" ADD COLUMN     "kind" TEXT NOT NULL DEFAULT 'GENERAL';

-- CreateIndex
CREATE INDEX "schedule_notes_date_kind_idx" ON "schedule_notes"("date", "kind");
