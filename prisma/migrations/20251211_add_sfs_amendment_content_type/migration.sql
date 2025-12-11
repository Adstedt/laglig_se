-- Story 2.13: Add SFS_AMENDMENT to ContentType enum for amendment documents
-- This allows storing ändringsförfattningar (amendment statutes) as LegalDocument records

-- Add new value to ContentType enum
ALTER TYPE "ContentType" ADD VALUE 'SFS_AMENDMENT';
