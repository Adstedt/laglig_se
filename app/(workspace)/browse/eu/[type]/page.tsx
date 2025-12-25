import { redirect, notFound } from 'next/navigation'

// Map URL segment to content type
const EU_TYPE_MAP: Record<string, string> = {
  forordningar: 'EU_REGULATION',
  direktiv: 'EU_DIRECTIVE',
}

interface WorkspaceEuTypePageProps {
  params: Promise<{ type: string }>
}

/**
 * Redirect /browse/eu/[type] to /browse/eu?types=[content_type]
 * This keeps users on the main EU catalogue with full filtering context
 */
export default async function WorkspaceEuTypePage({
  params,
}: WorkspaceEuTypePageProps) {
  const { type } = await params
  const contentType = EU_TYPE_MAP[type]

  if (!contentType) {
    notFound()
  }

  // Redirect to main EU catalogue with type filter pre-selected
  redirect(`/browse/eu?types=${contentType}`)
}
