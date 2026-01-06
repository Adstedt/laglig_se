import { config } from 'dotenv'
import { resolve } from 'path'
config({ path: resolve(process.cwd(), '.env.local') })

import { createClient } from '@supabase/supabase-js'

async function main() {
  const client = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // List all folders in the bucket
  console.log('Checking storage folders...')
  const { data: folders, error: foldersError } = await client.storage
    .from('sfs-pdfs')
    .list('', { limit: 100 })

  if (foldersError) {
    console.log('Error:', foldersError)
    return
  }

  console.log('Folders found:', folders?.filter(f => !f.name.endsWith('.pdf')).map(f => f.name).join(', '))

  // Count files in key years
  const years = ['1998', '2000', '2010', '2020', '2024', '2025']
  for (const year of years) {
    const { data, error } = await client.storage
      .from('sfs-pdfs')
      .list(year, { limit: 5000 })

    if (error) {
      console.log(`${year}: Error - ${error.message}`)
    } else {
      const pdfCount = data?.filter(f => f.name.endsWith('.pdf')).length || 0
      console.log(`${year}: ${pdfCount} PDFs`)
    }
  }
}
main()
