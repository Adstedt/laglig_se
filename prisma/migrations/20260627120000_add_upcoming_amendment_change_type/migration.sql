-- AlterEnum: Story 9.8 — kommande SKOLFS-ändring (announced amendment, not yet effective).
-- Postgres requires ADD VALUE to run outside a transaction; Prisma emits enum
-- additions as standalone statements, so `migrate deploy` applies this safely.
ALTER TYPE "ChangeType" ADD VALUE 'UPCOMING_AMENDMENT';
