import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

async function inspectCachedItem() {
  const url = process.env.UPSTASH_REDIS_REST_URL!
  const token = process.env.UPSTASH_REDIS_REST_TOKEN!

  console.log('🔍 Inspecting cached list item...\n')

  // Get one of the cached items
  const key = 'list-item-details:4ab4d156-b3d2-4785-b684-b62897deb370'
  console.log(`Fetching: ${key}\n`)

  const getResponse = await fetch(`${url}/get/${key}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })

  const getResult = await getResponse.json()

  if (getResult.result) {
    try {
      // The result might be double-encoded
      let parsed = getResult.result

      // Keep parsing until we get an object
      while (typeof parsed === 'string') {
        parsed = JSON.parse(parsed)
      }

      console.log('✅ Successfully parsed cached item!')
      console.log('Structure:')
      console.log('  - ID:', parsed.id)
      console.log('  - Has document:', !!parsed.document)
      console.log('  - Document number:', parsed.document?.document_number)
      console.log('  - Has HTML content:', !!parsed.document?.html_content)
      console.log(
        '  - HTML content size:',
        parsed.document?.html_content?.length || 0,
        'chars'
      )
      console.log('  - Has full_text:', !!parsed.document?.full_text)
      console.log(
        '  - Full text size:',
        parsed.document?.full_text?.length || 0,
        'chars'
      )

      // Check the actual structure
      console.log('\nFirst 500 chars of raw result:')
      console.log(JSON.stringify(getResult.result).substring(0, 500))
    } catch (e) {
      console.log('❌ Failed to parse:', e)
      console.log('Raw result:', getResult.result)
    }
  } else {
    console.log('❌ No item found')
  }
}

inspectCachedItem()
