import * as dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

import { listPdfsForYear } from '../lib/supabase/storage'

async function main() {
  const year = parseInt(process.argv[2] || '2025', 10)
  const pdfs = await listPdfsForYear(year)
  console.log(`PDFs in storage for ${year}:`)
  pdfs.forEach((p) => console.log('  -', p))
  console.log('Total:', pdfs.length)
}

main().catch(console.error)
