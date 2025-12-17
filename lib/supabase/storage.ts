/**
 * Supabase Storage utilities for SFS PDFs
 *
 * Story 2.13: Amendment Documents & Historical Versions
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js'

const BUCKET_NAME = 'sfs-pdfs'

let adminClient: SupabaseClient | null = null

/**
 * Get admin Supabase client for storage operations (server-side only)
 * Uses service role key for full access
 */
export function getStorageClient(): SupabaseClient {
  if (adminClient) return adminClient

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      'Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY'
    )
  }

  adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })

  return adminClient
}

/**
 * Generate storage path for an SFS document
 * Pattern: YYYY/SFSYYYY-NNNN.pdf
 */
export function getStoragePath(sfsNumber: string): string {
  // sfsNumber format: "2025:1461"
  const [year, num] = sfsNumber.split(':')
  return `${year}/SFS${year}-${num}.pdf`
}

/**
 * Upload a PDF to Supabase Storage
 */
export async function uploadPdf(
  sfsNumber: string,
  pdfBuffer: Buffer
): Promise<{ path: string; error: Error | null }> {
  const client = getStorageClient()
  const path = getStoragePath(sfsNumber)

  const { error } = await client.storage
    .from(BUCKET_NAME)
    .upload(path, pdfBuffer, {
      contentType: 'application/pdf',
      upsert: true, // Overwrite if exists
    })

  if (error) {
    return { path, error: new Error(error.message) }
  }

  return { path, error: null }
}

/**
 * Check if a PDF exists in storage
 */
export async function pdfExists(sfsNumber: string): Promise<boolean> {
  const client = getStorageClient()
  const path = getStoragePath(sfsNumber)
  const [folder, filename] = path.split('/')

  if (!folder || !filename) return false

  const { data, error } = await client.storage.from(BUCKET_NAME).list(folder, {
    search: filename,
  })

  if (error) return false
  return data?.some((f) => f.name === filename) ?? false
}

/**
 * Get a signed URL for downloading a PDF (valid for 1 hour)
 */
export async function getSignedUrl(sfsNumber: string): Promise<string | null> {
  const client = getStorageClient()
  const path = getStoragePath(sfsNumber)

  const { data, error } = await client.storage
    .from(BUCKET_NAME)
    .createSignedUrl(path, 60 * 60) // 1 hour

  if (error) return null
  return data.signedUrl
}

/**
 * Download PDF content from storage
 */
export async function downloadPdf(sfsNumber: string): Promise<Buffer | null> {
  const client = getStorageClient()
  const path = getStoragePath(sfsNumber)

  const { data, error } = await client.storage.from(BUCKET_NAME).download(path)

  if (error || !data) return null
  return Buffer.from(await data.arrayBuffer())
}

/**
 * Delete a PDF from storage
 */
export async function deletePdf(sfsNumber: string): Promise<boolean> {
  const client = getStorageClient()
  const path = getStoragePath(sfsNumber)

  const { error } = await client.storage.from(BUCKET_NAME).remove([path])

  return !error
}

/**
 * Get public URL for a PDF given its storage path
 * Storage paths look like: "2025/SFS2025-732.pdf" or "SFS 2013/SFSSFS 2013-610.pdf"
 */
export function getPublicPdfUrl(storagePath: string): string {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!supabaseUrl) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL')
  }
  // URL encode the path to handle spaces
  const encodedPath = storagePath.split('/').map(encodeURIComponent).join('/')
  return `${supabaseUrl}/storage/v1/object/public/${BUCKET_NAME}/${encodedPath}`
}

/**
 * List all PDFs for a given year
 */
export async function listPdfsForYear(year: number): Promise<string[]> {
  const client = getStorageClient()

  const { data, error } = await client.storage
    .from(BUCKET_NAME)
    .list(String(year), {
      limit: 2000,
      sortBy: { column: 'name', order: 'asc' },
    })

  if (error || !data) return []

  // Convert filenames back to SFS numbers
  return data
    .filter((f) => f.name.endsWith('.pdf'))
    .map((f) => {
      // SFS2025-1461.pdf -> 2025:1461
      const match = f.name.match(/SFS(\d{4})-(\d+)\.pdf/)
      return match ? `${match[1]}:${match[2]}` : null
    })
    .filter((n): n is string => n !== null)
}
