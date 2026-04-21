/**
 * Story 20.3: Workspace Krav Overview.
 * Server component — reads searchParams per the Next.js 16 pattern, pre-fetches
 * workspace members, and hands off to <KravPageContent />.
 */

import { KravPageContent } from '@/components/features/krav/krav-page-content'
import { getWorkspaceMembers } from '@/app/actions/document-list'

export const metadata = {
  title: 'Krav',
  description:
    'Alla kravpunkter i din arbetsyta — filtrera efter luckor, mina krav eller krav som saknar bevis.',
}

interface KravPageProps {
  searchParams: Promise<{
    filter?: string
    search?: string
    sort?: string
    dir?: string
  }>
}

export default async function KravPage({ searchParams }: KravPageProps) {
  const [params, membersResult] = await Promise.all([
    searchParams,
    getWorkspaceMembers(),
  ])

  const members =
    membersResult.success && membersResult.data ? membersResult.data : []

  return (
    <KravPageContent
      initialFilter={params.filter}
      initialSearch={params.search}
      initialSortField={params.sort}
      initialSortDirection={params.dir}
      members={members}
    />
  )
}
