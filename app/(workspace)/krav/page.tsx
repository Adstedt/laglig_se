/**
 * Story 20.3: Workspace Krav Overview.
 * Server component — reads searchParams per the Next.js 16 pattern, pre-fetches
 * workspace members, and hands off to <KravPageContent />.
 */

import { KravPageContent } from '@/components/features/krav/krav-page-content'
import { getWorkspaceMembers } from '@/app/actions/document-list'
import { getWorkspaceLawLists } from '@/app/actions/tasks'

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
    laglista?: string
    ansvarig?: string
  }>
}

export default async function KravPage({ searchParams }: KravPageProps) {
  const [params, membersResult, lawListsResult] = await Promise.all([
    searchParams,
    getWorkspaceMembers(),
    getWorkspaceLawLists(),
  ])

  const members =
    membersResult.success && membersResult.data ? membersResult.data : []
  // Facet options only need id + name; itemCount is dropped.
  const lawLists =
    lawListsResult.success && lawListsResult.data
      ? lawListsResult.data.map((l) => ({ id: l.id, name: l.name }))
      : []

  return (
    <KravPageContent
      initialFilter={params.filter}
      initialSearch={params.search}
      initialSortField={params.sort}
      initialSortDirection={params.dir}
      initialLaglista={params.laglista}
      initialResponsible={params.ansvarig}
      members={members}
      lawLists={lawLists}
    />
  )
}
