import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ContentType } from '@prisma/client'

vi.mock('@/lib/prisma', () => ({
  prisma: { legalDocument: { findMany: vi.fn() } },
}))

import { prisma } from '@/lib/prisma'
import { resolveCatalogLinks } from '@/lib/marketing/catalog-link'

const findMany = vi.mocked(prisma.legalDocument.findMany)

const AML_ROW = {
  document_number: 'SFS 1977:1160',
  slug: 'arbetsmiljolag-1977-1160',
  title: 'Arbetsmiljölag (1977:1160)',
  content_type: ContentType.SFS_LAW,
}
const AFS_ROW = {
  document_number: 'AFS 2023:12',
  slug: 'afs-2023-12',
  title: 'AFS 2023:12 Utformning av arbetsplatser',
  content_type: ContentType.AGENCY_REGULATION,
}
const COURT_ROW = {
  document_number: 'NJA 2023 s. 45',
  slug: 'nja-2023-s-45',
  title: 'NJA 2023 s. 45',
  content_type: ContentType.COURT_CASE_HD,
}

beforeEach(() => {
  findMany.mockReset()
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})

describe('resolveCatalogLinks', () => {
  it('matches by documentNumber → verified href + DB title', async () => {
    findMany.mockResolvedValue([AML_ROW] as never)
    const [r] = await resolveCatalogLinks([
      { documentNumber: 'SFS 1977:1160', title: 'Egen titel' },
    ])
    expect(r).toEqual({
      title: 'Arbetsmiljölag (1977:1160)', // DB title wins over frontmatter
      href: '/lagar/arbetsmiljolag-1977-1160',
      status: 'matched',
      contentType: ContentType.SFS_LAW,
    })
  })

  it('matches by slug and routes agency regulations to /foreskrifter', async () => {
    findMany.mockResolvedValue([AFS_ROW] as never)
    const [r] = await resolveCatalogLinks([{ slug: 'afs-2023-12' }])
    expect(r?.href).toBe('/foreskrifter/afs-2023-12')
    expect(r?.status).toBe('matched')
  })

  it('documentNumber match takes precedence over a slug match', async () => {
    findMany.mockResolvedValue([AML_ROW, AFS_ROW] as never)
    const [r] = await resolveCatalogLinks([
      { documentNumber: 'SFS 1977:1160', slug: 'afs-2023-12' },
    ])
    expect(r?.href).toBe('/lagar/arbetsmiljolag-1977-1160')
  })

  it('appends #anchor to matched hrefs', async () => {
    findMany.mockResolvedValue([AML_ROW] as never)
    const [r] = await resolveCatalogLinks([
      { documentNumber: 'SFS 1977:1160', anchor: 'kap-3' },
    ])
    expect(r?.href).toBe('/lagar/arbetsmiljolag-1977-1160#kap-3')
  })

  it('unmatched entry → null href, frontmatter title, console warning', async () => {
    findMany.mockResolvedValue([] as never)
    const [r] = await resolveCatalogLinks(
      [{ documentNumber: 'SFS 9999:999', title: 'Finns inte' }],
      'branscher/bygg'
    )
    expect(r).toEqual({ title: 'Finns inte', href: null, status: 'unmatched' })
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining(
        '[CATALOG_LINK_UNMATCHED] branscher/bygg: "SFS 9999:999"'
      )
    )
  })

  it('court-case rows (no public page) resolve as unmatched', async () => {
    findMany.mockResolvedValue([COURT_ROW] as never)
    const [r] = await resolveCatalogLinks([
      { documentNumber: 'NJA 2023 s. 45' },
    ])
    expect(r?.status).toBe('unmatched')
    expect(r?.href).toBeNull()
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining('no public page for COURT_CASE_HD')
    )
  })

  it('falls back to raw identifier when no title anywhere', async () => {
    findMany.mockResolvedValue([] as never)
    const [r] = await resolveCatalogLinks([{ slug: 'okand-lag' }])
    expect(r?.title).toBe('okand-lag')
  })

  it('makes exactly ONE query regardless of entry count', async () => {
    findMany.mockResolvedValue([AML_ROW, AFS_ROW] as never)
    await resolveCatalogLinks([
      { documentNumber: 'SFS 1977:1160' },
      { slug: 'afs-2023-12' },
      { documentNumber: 'SFS 9999:999' },
    ])
    expect(findMany).toHaveBeenCalledTimes(1)
    const where = findMany.mock.calls[0]?.[0]?.where
    expect(where?.status).toBe('ACTIVE')
  })

  it('short-circuits on empty entries (no query)', async () => {
    expect(await resolveCatalogLinks([])).toEqual([])
    expect(findMany).not.toHaveBeenCalled()
  })
})
