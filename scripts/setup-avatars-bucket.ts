/**
 * Set up Supabase Storage bucket for USER AVATARS
 *
 * Story 5.14: Personal Profile & Account Settings ("Min profil")
 *
 * Creates a PUBLIC `avatars` bucket (png/jpeg, max 2 MB). Avatars are
 * non-sensitive and rendered across the app, so a public bucket gives a
 * stable getPublicUrl() we persist directly to User.avatar_url (no signed
 * URL refresh needed). Server-side uploads use the service-role client
 * (lib/supabase/storage.ts pattern), which bypasses RLS for the write path.
 *
 * Idempotent: a no-op if the bucket already exists.
 *
 * Run ONCE per Supabase project (Preview/dev AND Production):
 *   pnpm tsx scripts/setup-avatars-bucket.ts
 */

import * as dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

import { createClient } from '@supabase/supabase-js'

const BUCKET_NAME = 'avatars'
const MAX_SIZE = 2 * 1024 * 1024 // 2 MB
const ALLOWED_MIME = ['image/png', 'image/jpeg']

async function main() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    console.error(
      'Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY'
    )
    process.exit(1)
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  console.log('='.repeat(60))
  console.log('Supabase Storage Setup — User Avatars')
  console.log('='.repeat(60))
  console.log(`URL: ${supabaseUrl}`)
  console.log(
    `Bucket: ${BUCKET_NAME} (public, ${MAX_SIZE / 1024 / 1024} MB, ${ALLOWED_MIME.join('/')})`
  )
  console.log()

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
    console.log(`\nBucket "${BUCKET_NAME}" already exists — nothing to do.`)
    console.log(`  - ID: ${existingBucket.id}`)
    console.log(`  - Public: ${existingBucket.public}`)
    console.log(`  - Created: ${existingBucket.created_at}`)
    if (!existingBucket.public) {
      console.warn(
        '\n⚠  Bucket exists but is PRIVATE. Story 5.14 expects a PUBLIC bucket so' +
          ' avatar_url can be stored as a stable public URL. Update it in the' +
          ' Supabase dashboard (Storage → avatars → Make public) if needed.'
      )
    }
    return
  }

  console.log(`\nCreating bucket "${BUCKET_NAME}"...`)

  const { data, error } = await supabase.storage.createBucket(BUCKET_NAME, {
    public: true,
    fileSizeLimit: MAX_SIZE,
    allowedMimeTypes: ALLOWED_MIME,
  })

  if (error) {
    console.error('Error creating bucket:', error.message)
    process.exit(1)
  }

  console.log('Bucket created successfully!')
  console.log(`  - Name: ${data.name}`)

  // Smoke-test upload
  console.log('\nTesting upload capability...')
  // 1x1 transparent PNG
  const onePxPng = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
    'base64'
  )
  const testPath = '_test/upload-test.png'

  const { error: uploadError } = await supabase.storage
    .from(BUCKET_NAME)
    .upload(testPath, onePxPng, { contentType: 'image/png', upsert: true })

  if (uploadError) {
    console.error('Upload test failed:', uploadError.message)
  } else {
    console.log('Upload test passed!')
    await supabase.storage.from(BUCKET_NAME).remove([testPath])
    console.log('Test file cleaned up.')
  }

  console.log('\n' + '='.repeat(60))
  console.log('Setup complete!')
  console.log('='.repeat(60))
  console.log(
    `\nStorage path pattern: ${BUCKET_NAME}/<userId>/avatar-<timestamp>.<ext>`
  )
}

main().catch(console.error)
