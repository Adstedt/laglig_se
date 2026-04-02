-- AlterTable
ALTER TABLE "amendment_documents" ADD COLUMN "proposition_id" TEXT;
ALTER TABLE "amendment_documents" ADD COLUMN "proposition_title" TEXT;
ALTER TABLE "amendment_documents" ADD COLUMN "proposition_summary" TEXT;
ALTER TABLE "amendment_documents" ADD COLUMN "proposition_organ" TEXT;
ALTER TABLE "amendment_documents" ADD COLUMN "proposition_datum" TIMESTAMP(3);
