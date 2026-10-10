CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Many-to-many link between tasks and cleaners, including per-cleaner WhatsApp state.
-- Legacy columns on "tasks" (assigned_to_user_id, whatsapp_sent_at, etc.) are left
-- in place for backward compatibility during deployment; they will be removed in a
-- follow-up migration after every environment is running the new code.
CREATE TABLE "task_assigned_cleaners" (
    "id" TEXT NOT NULL,
    "task_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "whatsapp_sent_at" TIMESTAMP(3),
    "whatsapp_sent_checkout_time" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "task_assigned_cleaners_pkey" PRIMARY KEY ("id")
);

-- Migrate existing single assignments and their WhatsApp send state.
INSERT INTO "task_assigned_cleaners" ("id", "task_id", "user_id", "whatsapp_sent_at", "whatsapp_sent_checkout_time", "created_at")
SELECT
    gen_random_uuid()::text,
    t.id,
    t.assigned_to_user_id,
    t.whatsapp_sent_at,
    t.whatsapp_sent_checkout_time,
    CURRENT_TIMESTAMP
FROM "tasks" t
WHERE t.assigned_to_user_id IS NOT NULL;

CREATE UNIQUE INDEX "task_assigned_cleaners_task_id_user_id_key" ON "task_assigned_cleaners"("task_id", "user_id");
CREATE INDEX "task_assigned_cleaners_task_id_idx" ON "task_assigned_cleaners"("task_id");
CREATE INDEX "task_assigned_cleaners_user_id_idx" ON "task_assigned_cleaners"("user_id");

ALTER TABLE "task_assigned_cleaners" ADD CONSTRAINT "task_assigned_cleaners_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "task_assigned_cleaners" ADD CONSTRAINT "task_assigned_cleaners_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
