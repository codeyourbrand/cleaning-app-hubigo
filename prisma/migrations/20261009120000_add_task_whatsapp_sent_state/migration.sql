-- AlterTable
ALTER TABLE "tasks" ADD COLUMN     "whatsapp_sent_at" TIMESTAMP(3),
ADD COLUMN     "whatsapp_sent_checkout_time" TEXT,
ADD COLUMN     "whatsapp_sent_to_user_id" TEXT;

-- Seed settings for the new WhatsApp events (idempotent)
INSERT INTO "whatsapp_notification_settings" ("id", "event_type", "enabled", "destination", "updatedAt")
VALUES
  (gen_random_uuid()::text, 'TASK_TIMING_CHANGED', true, 'USER', CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'TASK_COMMENTED', false, 'USER', CURRENT_TIMESTAMP)
ON CONFLICT ("event_type") DO NOTHING;
