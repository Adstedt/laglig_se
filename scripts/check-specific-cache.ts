import { redis } from '@/lib/cache/redis'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

async function checkCache() {
  console.log('🔍 Checking specific cached item...\n')
  
  // Check the list item that was just cached
  const listItemKey = 'list-item-details:5d3f9c6f-50de-47fe-8fbc-f4c93d8e8d93'
  const listItem = await redis.get(listItemKey)
  
  if (listItem) {
    console.log('✅ Found cached list item!')
    const parsed = typeof listItem === 'string' ? JSON.parse(listItem) : listItem
    console.log('  Document ID:', parsed.document?.id)
    console.log('  Document Number:', parsed.document?.document_number)
    console.log('  Has full_text:', !!parsed.document?.full_text)
    console.log('  Has html_content:', !!parsed.document?.html_content)
    
    // Check if document content is cached separately
    if (parsed.document?.id) {
      const docKey = `document:content:${parsed.document.id}`
      const doc = await redis.get(docKey)
      if (doc) {
        console.log('\n✅ Document content is ALSO cached!')
        const docParsed = typeof doc === 'string' ? JSON.parse(doc) : doc
        console.log('  Content size:', JSON.stringify(docParsed).length, 'bytes')
      } else {
        console.log('\n❌ Document content NOT cached separately')
      }
    }
  } else {
    console.log('❌ List item not found in cache')
    
    // Try the shorter key
    const shortKey = 'list-item-details:5d3f9c6f'
    const shortItem = await redis.get(shortKey)
    if (shortItem) {
      console.log('✅ Found with short key!')
    }
  }
  
  // List all keys (if supported)
  try {
    const keys = await redis.keys('*')
    console.log(`\n📦 Total keys in Redis: ${keys.length}`)
    if (keys.length > 0 && keys.length < 20) {
      console.log('Keys:', keys)
    }
  } catch (e) {
    // Keys command might not be supported
  }
}

checkCache()
