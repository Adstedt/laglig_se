import { redirect, notFound } from 'next/navigation'

// Map URL segment to content type
const COURT_MAP: Record<string, string> = {
  hd: 'COURT_CASE_HD',
  hovr: 'COURT_CASE_HOVR',
  hfd: 'COURT_CASE_HFD',
  ad: 'COURT_CASE_AD',
  mod: 'COURT_CASE_MOD',
  mig: 'COURT_CASE_MIG',
}

interface WorkspaceCourtPageProps {
  params: Promise<{ court: string }>
}

/**
 * Redirect /browse/rattsfall/[court] to /browse/rattsfall?types=[content_type]
 * This keeps users on the main catalogue with full filtering context
 */
export default async function WorkspaceCourtPage({
  params,
}: WorkspaceCourtPageProps) {
  const { court } = await params
  const contentType = COURT_MAP[court]

  if (!contentType) {
    notFound()
  }

  // Redirect to main catalogue with court filter pre-selected
  redirect(`/browse/rattsfall?types=${contentType}`)
}
