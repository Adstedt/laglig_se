import { config } from 'dotenv'
import { resolve } from 'path'
config({ path: resolve(process.cwd(), '.env.local') })

import { createClient } from '@supabase/supabase-js'

async function main() {
  const client = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // Check 'SFS 2025' folder
  console.log('Checking "SFS 2025" folder...')
  const { data: d1, error: e1 } = await client.storage
    .from('sfs-pdfs')
    .list('SFS 2025', { limit: 10 })

  if (e1) {
    console.log('Error:', e1.message)
  } else {
    console.log('Found', d1?.length, 'files:')
    d1?.forEach(f => console.log(' ', f.name))
  }

  // Check 'SFS 1998' folder
  console.log('\nChecking "SFS 1998" folder...')
  const { data: d2, error: e2 } = await client.storage
    .from('sfs-pdfs')
    .list('SFS 1998', { limit: 10 })

  if (e2) {
    console.log('Error:', e2.message)
  } else {
    console.log('Found', d2?.length, 'files:')
    d2?.forEach(f => console.log(' ', f.name))
  }

  // Try downloading from "SFS 2025" folder
  console.log('\nTrying to download SFS 2025/SFSSFS 2025-1.pdf...')
  const { data: pdf, error: pdfError } = await client.storage
    .from('sfs-pdfs')
    .download('SFS 2025/SFSSFS 2025-1.pdf')

  if (pdfError) {
    console.log('Error:', pdfError.message)
  } else if (pdf) {
    console.log('Success! Got', (await pdf.arrayBuffer()).byteLength, 'bytes')
  }
}
main()
