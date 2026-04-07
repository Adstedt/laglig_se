import { toast } from 'sonner'
import { uploadDocumentImageAction } from '@/app/actions/documents'

const MAX_IMAGE_SIZE = 10 * 1024 * 1024 // 10MB
const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp']

export async function uploadDocumentImage(
  file: File,
  documentId: string
): Promise<string | null> {
  if (!ALLOWED_TYPES.includes(file.type)) {
    toast.error('Ogiltigt filformat. Tillåtna format: PNG, JPG, GIF, WebP')
    return null
  }

  if (file.size > MAX_IMAGE_SIZE) {
    toast.error('Bilden är för stor. Max storlek: 10MB')
    return null
  }

  const formData = new FormData()
  formData.append('file', file)
  formData.append('documentId', documentId)

  const result = await uploadDocumentImageAction(formData)

  if (!result.success) {
    toast.error(result.error ?? 'Bilduppladdning misslyckades')
    return null
  }

  return result.data?.url ?? null
}
