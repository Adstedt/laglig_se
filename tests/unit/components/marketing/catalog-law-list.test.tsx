import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ContentType } from '@prisma/client'

vi.mock('@/lib/marketing/catalog-link', () => ({
  resolveCatalogLinks: vi.fn(),
}))

import { resolveCatalogLinks } from '@/lib/marketing/catalog-link'
import { CatalogLawList } from '@/components/marketing/sections/catalog-law-list'

const resolveMock = vi.mocked(resolveCatalogLinks)

const RESOLVED = [
  {
    title: 'Arbetsmiljölag (1977:1160)',
    href: '/lagar/arbetsmiljolag-1977-1160',
    status: 'matched' as const,
    contentType: ContentType.SFS_LAW,
  },
  {
    title: 'AFS 2023:12 Utformning av arbetsplatser',
    href: '/foreskrifter/afs-2023-12',
    status: 'matched' as const,
    contentType: ContentType.AGENCY_REGULATION,
  },
  {
    title: 'GDPR',
    href: '/eu/forordningar/gdpr',
    status: 'matched' as const,
    contentType: ContentType.EU_REGULATION,
  },
  {
    title: 'Finns inte-lagen',
    href: null,
    status: 'unmatched' as const,
  },
]

const ENTRIES = [{ documentNumber: 'SFS 1977:1160' }]

beforeEach(() => {
  resolveMock.mockReset()
  resolveMock.mockResolvedValue(RESOLVED)
})

describe('<CatalogLawList> (live path)', () => {
  it('renders matched entries as links with verified hrefs', async () => {
    render(await CatalogLawList({ entries: ENTRIES }))
    expect(
      screen.getByRole('link', { name: /arbetsmiljölag/i }).getAttribute('href')
    ).toBe('/lagar/arbetsmiljolag-1977-1160')
    expect(
      screen.getByRole('link', { name: /afs 2023:12/i }).getAttribute('href')
    ).toBe('/foreskrifter/afs-2023-12')
  })

  it('renders unmatched entries as plain text, not links', async () => {
    render(await CatalogLawList({ entries: ENTRIES }))
    expect(screen.getByText('Finns inte-lagen')).toBeTruthy()
    expect(screen.queryByRole('link', { name: 'Finns inte-lagen' })).toBeNull()
  })

  it('groupBy="content_type" renders the Swedish group headings in order', async () => {
    render(await CatalogLawList({ entries: ENTRIES, groupBy: 'content_type' }))
    const headings = ['Lagar & förordningar', 'Föreskrifter', 'EU-regler'].map(
      (h) => screen.getByText(h)
    )
    expect(headings).toHaveLength(3)
    // unmatched still rendered, after the groups
    expect(screen.getByText('Finns inte-lagen')).toBeTruthy()
  })

  it('passes entries + context through to the resolver', async () => {
    render(
      await CatalogLawList({ entries: ENTRIES, context: 'branscher/bygg' })
    )
    expect(resolveMock).toHaveBeenCalledWith(ENTRIES, 'branscher/bygg')
  })

  it('renders nothing for empty entries (no resolver call)', async () => {
    const result = await CatalogLawList({ entries: [] })
    expect(result).toBeNull()
    expect(resolveMock).not.toHaveBeenCalled()
  })
})
