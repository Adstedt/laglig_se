#!/usr/bin/env node

/**
 * Apply performance indexes manually
 * These indexes use CONCURRENTLY which cannot run in a transaction
 * Run this after applying Prisma migrations
 */

import { PrismaClient } from '@prisma/client'
import * as dotenv from 'dotenv'

// Load environment variables
dotenv.config({ path: '.env.local' })

const prisma = new PrismaClient()

const indexes = [
  {
    name: 'idx_law_list_items_list_id',
    sql: 'CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_law_list_items_list_id" ON "LawListItem"("law_list_id")'
  },
  {
    name: 'idx_law_list_items_position',
    sql: 'CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_law_list_items_position" ON "LawListItem"("position")'
  },
  {
    name: 'idx_law_list_items_status',
    sql: 'CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_law_list_items_status" ON "LawListItem"("compliance_status")'
  },
  {
    name: 'idx_law_list_items_responsible',
    sql: 'CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_law_list_items_responsible" ON "LawListItem"("responsible_user_id")'
  },
  {
    name: 'idx_law_list_items_list_position',
    sql: 'CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_law_list_items_list_position" ON "LawListItem"("law_list_id", "position")'
  },
  {
    name: 'idx_law_list_items_due_date',
    sql: 'CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_law_list_items_due_date" ON "LawListItem"("due_date") WHERE "due_date" IS NOT NULL'
  },
  {
    name: 'idx_law_list_items_priority',
    sql: 'CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_law_list_items_priority" ON "LawListItem"("priority")'
  },
  // Also add document_id index which is critical for the modal query
  {
    name: 'idx_law_list_items_document_id',
    sql: 'CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_law_list_items_document_id" ON "LawListItem"("document_id")'
  }
]

async function applyIndexes() {
  console.log('🚀 Applying performance indexes...\n')
  
  for (const index of indexes) {
    try {
      console.log(`Creating index: ${index.name}...`)
      // Use $executeRawUnsafe to run raw SQL outside transaction
      await prisma.$executeRawUnsafe(index.sql)
      console.log(`✅ ${index.name} created successfully`)
    } catch (error: any) {
      if (error.message?.includes('already exists')) {
        console.log(`⏭️  ${index.name} already exists, skipping`)
      } else {
        console.error(`❌ Failed to create ${index.name}:`, error.message)
      }
    }
  }
  
  console.log('\n📊 Verifying indexes...')
  
  // Check which indexes exist
  const existingIndexes = await prisma.$queryRaw`
    SELECT indexname, tablename 
    FROM pg_indexes 
    WHERE tablename = 'LawListItem' 
    AND indexname LIKE 'idx_law_list_items_%'
    ORDER BY indexname
  ` as Array<{indexname: string, tablename: string}>
  
  console.log('\nExisting indexes on LawListItem:')
  existingIndexes.forEach(idx => {
    console.log(`  ✓ ${idx.indexname}`)
  })
  
  console.log('\n✨ Index application complete!')
}

applyIndexes()
  .catch((error) => {
    console.error('Fatal error:', error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })