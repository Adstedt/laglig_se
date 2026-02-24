-- AlterEnum: Add Epic 8 change monitoring notification types
ALTER TYPE "NotificationType" ADD VALUE 'AMENDMENT_DETECTED';
ALTER TYPE "NotificationType" ADD VALUE 'LAW_REPEALED';
ALTER TYPE "NotificationType" ADD VALUE 'RULING_CITED';
ALTER TYPE "NotificationType" ADD VALUE 'AMENDMENT_REMINDER';

-- AlterTable: Add per-type preference toggles for new notification types
ALTER TABLE "notification_preferences" ADD COLUMN "amendment_detected_enabled" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "notification_preferences" ADD COLUMN "law_repealed_enabled" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "notification_preferences" ADD COLUMN "ruling_cited_enabled" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "notification_preferences" ADD COLUMN "amendment_reminder_enabled" BOOLEAN NOT NULL DEFAULT true;
