-- Migrate existing Hostfully-synced CLEANING tasks to CHECK_OUT
UPDATE "tasks" SET "type" = 'CHECK_OUT' WHERE "type" = 'CLEANING' AND "external_hostfully_reservation_id" IS NOT NULL;
