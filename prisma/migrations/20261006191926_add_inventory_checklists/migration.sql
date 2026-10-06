-- CreateEnum
CREATE TYPE "InventoryChecklistType" AS ENUM ('APARTMENT', 'STORAGE');

-- CreateTable
CREATE TABLE "inventory_checklists" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "InventoryChecklistType" NOT NULL,
    "apartment_id" TEXT,
    "notes" TEXT,
    "created_by_user_id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inventory_checklists_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_items" (
    "id" TEXT NOT NULL,
    "checklist_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "checked" BOOLEAN NOT NULL DEFAULT false,
    "checked_at" TIMESTAMP(3),
    "checked_by_user_id" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inventory_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "inventory_checklists_apartment_id_idx" ON "inventory_checklists"("apartment_id");

-- CreateIndex
CREATE INDEX "inventory_checklists_type_idx" ON "inventory_checklists"("type");

-- CreateIndex
CREATE INDEX "inventory_items_checklist_id_order_idx" ON "inventory_items"("checklist_id", "order");

-- AddForeignKey
ALTER TABLE "inventory_checklists" ADD CONSTRAINT "inventory_checklists_apartment_id_fkey" FOREIGN KEY ("apartment_id") REFERENCES "apartments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_checklists" ADD CONSTRAINT "inventory_checklists_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_items" ADD CONSTRAINT "inventory_items_checklist_id_fkey" FOREIGN KEY ("checklist_id") REFERENCES "inventory_checklists"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_items" ADD CONSTRAINT "inventory_items_checked_by_user_id_fkey" FOREIGN KEY ("checked_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
