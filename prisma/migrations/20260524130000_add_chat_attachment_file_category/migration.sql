-- Story 19.1: chat attachments are uploaded with this category and kept out of
-- Filer + the RAG index until explicitly promoted (Story 19.1b).
-- AlterEnum
ALTER TYPE "FileCategory" ADD VALUE 'CHAT_ATTACHMENT';
