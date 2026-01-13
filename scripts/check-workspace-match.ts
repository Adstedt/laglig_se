import { Redis } from '@upstash/redis'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

async function checkWorkspaceMatch() {
  console.log('🔍 Checking workspace in cached items...\n')
  
  const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL!,
    token: process.env.UPSTASH_REDIS_REST_TOKEN!,
  })
  
  // Get all cached list items
  const keys = await redis.keys('list-item-details:*')
  console.log(`Found ${keys.length} cached items\n`)
  
  for (const key of keys.slice(0, 5)) {
    const item = await redis.get(key)
    const parsed = typeof item === 'string' ? JSON.parse(item) : item
    
    console.log(`📄 ${key.substring(0, 50)}...`)
    console.log(`  - Document: ${parsed.document?.document_number}`)
    console.log(`  - Law list ID: ${parsed.law_list?.id || parsed.law_list_id}`)
    console.log(`  - Law list name: ${parsed.law_list?.name || 'N/A'}`)
    console.log(`  - Workspace ID: ${parsed.law_list?.workspace_id || 'NOT FOUND'}`)
    
    if (!parsed.law_list?.workspace_id) {
      console.log('  ⚠️  Missing workspace_id in law_list object!')
    }
    console.log()
  }
  
  // Also check if we're caching the right structure
  if (keys.length > 0) {
    const item = await redis.get(keys[0])
    const parsed = typeof item === 'string' ? JSON.parse(item) : item
    
    console.log('🔍 Structure of first cached item:')
    console.log('Top-level keys:', Object.keys(parsed))
    if (parsed.law_list) {
      console.log('law_list keys:', Object.keys(parsed.law_list))
    }
    if (parsed.document) {
      console.log('document keys:', Object.keys(parsed.document).slice(0, 10))
    }
  }
}

checkWorkspaceMatch()