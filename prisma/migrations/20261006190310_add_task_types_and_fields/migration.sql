-- AlterEnum
ALTER TYPE "TaskType" ADD VALUE IF NOT EXISTS 'CHECK_OUT';
ALTER TYPE "TaskType" ADD VALUE IF NOT EXISTS 'REFRESH';

-- AlterTable
ALTER TABLE "tasks" ADD COLUMN     "custom_type_name" TEXT,
ADD COLUMN     "title" TEXT;
