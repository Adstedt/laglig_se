import { config } from 'dotenv'
import { resolve } from 'path'
config({ path: resolve(process.cwd(), '.env.local') })

import { createClient } from '@supabase/supabase-js'

async function main() {
  const client = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // List files in 2025 folder
  console.log('Listing files in 2025/ folder...')
  const { data, error } = await client.storage
    .from('sfs-pdfs')
    .list('2025', { limit: 20 })

  if (error) {
    console.log('Error:', error)
  } else {
    console.log('Found', data?.length, 'files:')
    data?.slice(0, 10).forEach(f => console.log(' ', f.name))
  }

  // Also try a file we know worked (from earlier batches)
  console.log('\n--- Testing known working file from 1998 ---')
  const { data: data1998, error: error1998 } = await client.storage
    .from('sfs-pdfs')
    .list('1998', { limit: 5 })

  if (error1998) {
    console.log('Error:', error1998)
  } else {
    console.log('1998 folder has', data1998?.length, 'files')
    if (data1998?.[0]) {
      console.log('Trying to download:', `1998/${data1998[0].name}`)
      const { data: pdf, error: dlError } = await client.storage
        .from('sfs-pdfs')
        .download(`1998/${data1998[0].name}`)

      if (dlError) {
        console.log('Download error:', dlError)
      } else if (pdf) {
        console.log('Success! Got', (await pdf.arrayBuffer()).byteLength, 'bytes')
      }
    }
  }
}
main()
