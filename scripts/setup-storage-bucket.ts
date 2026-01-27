/**
 * Set up Supabase Storage bucket for SFS PDFs
 *
 * Story 2.13: Amendment Documents & Historical Versions
 * Phase 2, Task 2.3: Set up Supabase Storage
 *
 * Usage:
 *   pnpm tsx scripts/setup-storage-bucket.ts
 */

import * as dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

import { createClient } from '@supabase/supabase-js'

const BUCKET_NAME = 'sfs-pdfs'

async function main() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    console.error(
      'Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY'
    )
    process.exit(1)
  }

  // Create admin client with service role key
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })

  console.log('='.repeat(60))
  console.log('Supabase Storage Setup')
  console.log('='.repeat(60))
  console.log(`URL: ${supabaseUrl}`)
  console.log(`Bucket: ${BUCKET_NAME}`)
  console.log()

  // Check if bucket exists
  const { data: buckets, error: listError } =
    await supabase.storage.listBuckets()

  if (listError) {
    console.error('Error listing buckets:', listError.message)
    process.exit(1)
  }

  console.log(
    'Existing buckets:',
    buckets?.map((b) => b.name).join(', ') || 'none'
  )

  const existingBucket = buckets?.find((b) => b.name === BUCKET_NAME)

  if (existingBucket) {
    console.log(`\nBucket "${BUCKET_NAME}" already exists.`)
    console.log(`  - ID: ${existingBucket.id}`)
    console.log(`  - Public: ${existingBucket.public}`)
    console.log(`  - Created: ${existingBucket.created_at}`)
    return
  }

  // Create bucket
  console.log(`\nCreating bucket "${BUCKET_NAME}"...`)

  const { data, error } = await supabase.storage.createBucket(BUCKET_NAME, {
    public: false, // Private bucket - access via signed URLs or authenticated requests
    fileSizeLimit: 10 * 1024 * 1024, // 10MB max (PDFs are typically 50-200KB)
    allowedMimeTypes: ['application/pdf'],
  })

  if (error) {
    console.error('Error creating bucket:', error.message)
    process.exit(1)
  }

  console.log(`Bucket created successfully!`)
  console.log(`  - Name: ${data.name}`)

  // Test upload capability
  console.log('\nTesting upload capability...')

  const testContent = Buffer.from('%PDF-1.4 test')
  const testPath = '_test/upload-test.pdf'

  const { error: uploadError } = await supabase.storage
    .from(BUCKET_NAME)
    .upload(testPath, testContent, {
      contentType: 'application/pdf',
      upsert: true,
    })

  if (uploadError) {
    console.error('Upload test failed:', uploadError.message)
  } else {
    console.log('Upload test passed!')

    // Clean up test file
    await supabase.storage.from(BUCKET_NAME).remove([testPath])
    console.log('Test file cleaned up.')
  }

  console.log('\n' + '='.repeat(60))
  console.log('Setup complete!')
  console.log('='.repeat(60))
  console.log(`\nStorage path pattern: ${BUCKET_NAME}/YYYY/SFSYYYY-NNNN.pdf`)
  console.log('Example: sfs-pdfs/2025/SFS2025-1461.pdf')
}

main().catch(console.error)
