import { describe, it, expect } from 'vitest'
import { linkifyHtmlContent } from '@/lib/linkify/linkify-html'
import type { SlugMap } from '@/lib/linkify/build-slug-map'

/** Helper to build a test slug map */
function createSlugMap(
  entries: Array<{
    docNumber: string
    slug: string
    contentType: string
    title: string
    id?: string
  }>
): SlugMap {
  const map: SlugMap = new Map()
  for (const entry of entries) {
    map.set(entry.docNumber, {
      slug: entry.slug,
      contentType: entry.contentType,
      title: entry.title,
      id: entry.id ?? `id-${entry.slug}`,
    })
  }
  return map
}

const defaultMap = createSlugMap([
  {
    docNumber: 'SFS 1982:673',
    slug: 'arbetstidslag-1982-673',
    contentType: 'SFS_LAW',
    title: 'Arbetstidslag (1982:673)',
  },
  {
    docNumber: 'SFS 2012:295',
    slug: 'some-law-2012-295',
    contentType: 'SFS_LAW',
    title: 'Lag (2012:295)',
  },
  {
    docNumber: 'AFS 2001:1',
    slug: 'afs-2001-1',
    contentType: 'AGENCY_REGULATION',
    title: 'Systematiskt arbetsmiljöarbete',
  },
  {
    docNumber: 'AD 2019 nr 45',
    slug: 'ad-2019-nr-45',
    contentType: 'COURT_CASE_AD',
    title: 'AD 2019 nr 45',
  },
  {
    docNumber: 'NJA 2020 s. 45',
    slug: 'nja-2020-s-45',
    contentType: 'COURT_CASE_HD',
    title: 'NJA 2020 s. 45',
  },
])

describe('linkifyHtmlContent', () => {
  describe('basic linkification', () => {
    it('linkifies an SFS law reference', () => {
      const { html } = linkifyHtmlContent(
        '<p>Se lagen (1982:673) för detaljer.</p>',
        defaultMap
      )
      expect(html).toContain('href="/lagar/arbetstidslag-1982-673"')
      expect(html).toContain('class="legal-ref"')
      expect(html).toContain('title="Arbetstidslag (1982:673)"')
    })

    it('linkifies an agency regulation reference', () => {
      const { html } = linkifyHtmlContent(
        '<p>Enligt AFS 2001:1 om arbetsmiljö.</p>',
        defaultMap
      )
      expect(html).toContain('href="/foreskrifter/afs-2001-1"')
      expect(html).toContain('class="legal-ref"')
      // title attribute uses our manual escapeAttr, ö stays as-is with decodeEntities:false
      expect(html).toContain('Systematiskt arbetsmilj')
    })

    it('linkifies a court case reference', () => {
      const { html } = linkifyHtmlContent(
        '<p>Se AD 2019 nr 45.</p>',
        defaultMap
      )
      expect(html).toContain('href="/rattsfall/ad/ad-2019-nr-45"')
    })

    it('linkifies multiple references in one paragraph', () => {
      const { html } = linkifyHtmlContent(
        '<p>Se lagen (1982:673) och AFS 2001:1 samt AD 2019 nr 45.</p>',
        defaultMap
      )
      expect(html).toContain('href="/lagar/arbetstidslag-1982-673"')
      expect(html).toContain('href="/foreskrifter/afs-2001-1"')
      expect(html).toContain('href="/rattsfall/ad/ad-2019-nr-45"')
    })

    it('linkifies references across multiple elements', () => {
      const { html } = linkifyHtmlContent(
        '<p>Se lagen (1982:673).</p><p>Se även AFS 2001:1.</p>',
        defaultMap
      )
      expect(html).toContain('href="/lagar/arbetstidslag-1982-673"')
      expect(html).toContain('href="/foreskrifter/afs-2001-1"')
    })
  })

  describe('HTML-awareness', () => {
    it('unwraps non-paragraf <a> tags and linkifies the exposed text', () => {
      const { html } = linkifyHtmlContent(
        '<p>Se <a href="/other">lagen (1982:673)</a>.</p>',
        defaultMap
      )
      // External links are stripped so text can be re-linked with legal-ref
      expect(html).toContain('class="legal-ref"')
      expect(html).toContain('href="/lagar/arbetstidslag-1982-673"')
      expect(html).not.toContain('href="/other"')
    })

    it('does NOT linkify inside <code> blocks', () => {
      const { html } = linkifyHtmlContent(
        '<p>Exempelkod: <code>lagen (1982:673)</code></p>',
        defaultMap
      )
      expect(html).not.toContain('class="legal-ref"')
    })

    it('does NOT linkify inside <script> tags', () => {
      const { html } = linkifyHtmlContent(
        '<script>var x = "lagen (1982:673)"</script><p>Annan text.</p>',
        defaultMap
      )
      expect(html).not.toContain('class="legal-ref"')
    })

    it('does NOT linkify inside <style> tags', () => {
      const { html } = linkifyHtmlContent(
        '<style>/* lagen (1982:673) */</style><p>Text.</p>',
        defaultMap
      )
      expect(html).not.toContain('class="legal-ref"')
    })

    it('does NOT linkify inside <pre> blocks', () => {
      const { html } = linkifyHtmlContent(
        '<pre>lagen (1982:673)</pre>',
        defaultMap
      )
      expect(html).not.toContain('class="legal-ref"')
    })

    it('preserves surrounding HTML structure', () => {
      const { html } = linkifyHtmlContent(
        '<div class="section"><h2>Rubrik</h2><p>Se lagen (1982:673).</p></div>',
        defaultMap
      )
      expect(html).toContain('<div class="section">')
      expect(html).toContain('<h2>Rubrik</h2>')
      expect(html).toContain('class="legal-ref"')
    })
  })

  describe('idempotency', () => {
    it('strips existing legal-ref links and re-linkifies', () => {
      const alreadyLinkified =
        '<p>Se <a href="/lagar/old-slug" class="legal-ref" title="Old Title">lagen (1982:673)</a>.</p>'
      const { html } = linkifyHtmlContent(alreadyLinkified, defaultMap)
      expect(html).toContain('href="/lagar/arbetstidslag-1982-673"')
      expect(html).not.toContain('old-slug')
      expect(html).not.toContain('Old Title')
    })

    it('produces same output when run twice', () => {
      const input = '<p>Se lagen (1982:673) och AFS 2001:1.</p>'
      const result1 = linkifyHtmlContent(input, defaultMap)
      const result2 = linkifyHtmlContent(result1.html, defaultMap)
      expect(result2.html).toBe(result1.html)
    })
  })

  describe('self-reference exclusion', () => {
    it('does NOT link a document to itself', () => {
      const { html } = linkifyHtmlContent(
        '<p>Denna lag (1982:673) gäller.</p>',
        defaultMap,
        'SFS 1982:673'
      )
      expect(html).not.toContain('class="legal-ref"')
    })

    it('still links other references when self-reference is excluded', () => {
      const { html } = linkifyHtmlContent(
        '<p>Denna lag (1982:673) hänvisar till AFS 2001:1.</p>',
        defaultMap,
        'SFS 1982:673'
      )
      expect(html).not.toContain('arbetstidslag-1982-673')
      expect(html).toContain('href="/foreskrifter/afs-2001-1"')
    })
  })

  describe('missing documents', () => {
    it('leaves reference as plain text when not in slug map', () => {
      const emptyMap: SlugMap = new Map()
      const { html } = linkifyHtmlContent(
        '<p>Se lagen (1999:999).</p>',
        emptyMap
      )
      expect(html).not.toContain('class="legal-ref"')
      expect(html).toContain('lagen (1999:999)')
    })

    it('links known references and leaves unknown ones as text', () => {
      const { html } = linkifyHtmlContent(
        '<p>Se lagen (1982:673) och lagen (1999:999).</p>',
        defaultMap
      )
      expect(html).toContain('href="/lagar/arbetstidslag-1982-673"')
      expect(html).toContain('lagen (1999:999)')
      // The unknown reference should NOT be wrapped in an <a> tag
      expect(html).not.toContain('1999:999</a>')
    })
  })

  describe('title attribute escaping', () => {
    it('escapes quotes in title', () => {
      const mapWithQuote = createSlugMap([
        {
          docNumber: 'SFS 1982:673',
          slug: 'test-slug',
          contentType: 'SFS_LAW',
          title: 'Lag med "citat" i titeln',
        },
      ])
      const { html } = linkifyHtmlContent(
        '<p>Se lagen (1982:673).</p>',
        mapWithQuote
      )
      expect(html).toContain('&quot;citat&quot;')
      expect(html).not.toMatch(/title="Lag med "citat"/)
    })

    it('handles angle brackets in title safely', () => {
      const mapWithBrackets = createSlugMap([
        {
          docNumber: 'SFS 1982:673',
          slug: 'test-slug',
          contentType: 'SFS_LAW',
          title: 'Lag <script>alert(1)</script>',
        },
      ])
      const { html } = linkifyHtmlContent(
        '<p>Se lagen (1982:673).</p>',
        mapWithBrackets
      )
      // Angle brackets inside quoted attribute values are safe HTML —
      // browsers don't interpret them as tags. cheerio normalizes them
      // as literal characters in the attribute value.
      expect(html).toContain('class="legal-ref"')
      expect(html).toContain('title=')
      // The link should still be created
      expect(html).toContain('href="/lagar/test-slug"')
    })

    it('escapes ampersands in title', () => {
      const mapWithAmp = createSlugMap([
        {
          docNumber: 'SFS 1982:673',
          slug: 'test-slug',
          contentType: 'SFS_LAW',
          title: 'Mark & Miljö',
        },
      ])
      const { html } = linkifyHtmlContent(
        '<p>Se lagen (1982:673).</p>',
        mapWithAmp
      )
      expect(html).toContain('Mark &amp; Milj')
    })
  })

  describe('linkedReferences output', () => {
    it('returns linked references with target document IDs', () => {
      const { linkedReferences } = linkifyHtmlContent(
        '<p>Se lagen (1982:673) och AFS 2001:1.</p>',
        defaultMap
      )
      expect(linkedReferences).toHaveLength(2)
      expect(linkedReferences[0]!.reference.documentNumber).toBe('SFS 1982:673')
      expect(linkedReferences[0]!.targetDocumentId).toBe(
        'id-arbetstidslag-1982-673'
      )
      expect(linkedReferences[1]!.reference.documentNumber).toBe('AFS 2001:1')
      expect(linkedReferences[1]!.targetDocumentId).toBe('id-afs-2001-1')
    })

    it('does not include self-references in linked list', () => {
      const { linkedReferences } = linkifyHtmlContent(
        '<p>Se lagen (1982:673).</p>',
        defaultMap,
        'SFS 1982:673'
      )
      expect(linkedReferences).toHaveLength(0)
    })

    it('does not include unresolved references in linked list', () => {
      const { linkedReferences } = linkifyHtmlContent(
        '<p>Se lagen (1999:999).</p>',
        defaultMap
      )
      expect(linkedReferences).toHaveLength(0)
    })
  })

  describe('content type verification', () => {
    it('does not link when slug map contentType mismatches detected type', () => {
      const mismatchMap = createSlugMap([
        {
          docNumber: 'AFS 2001:1',
          slug: 'wrong-type',
          contentType: 'SFS_LAW',
          title: 'Wrong type',
        },
      ])
      const { html } = linkifyHtmlContent('<p>Se AFS 2001:1.</p>', mismatchMap)
      expect(html).not.toContain('class="legal-ref"')
    })

    it('links SFS_AMENDMENT documents (amendment förordningar)', () => {
      const amendmentMap = createSlugMap([
        {
          docNumber: 'SFS 2009:38',
          slug: 'sfs-2009-38',
          contentType: 'SFS_AMENDMENT',
          title: 'Förordning om ändring i aktiebolagsförordningen (2005:559)',
        },
      ])
      const { html } = linkifyHtmlContent(
        '<p>Förordning (2009:38).</p>',
        amendmentMap
      )
      expect(html).toContain('class="legal-ref"')
      expect(html).toContain('sfs-2009-38"')
    })
  })

  describe('Riksdagen link stripping', () => {
    it('unwraps class="ref" links and linkifies exposed text', () => {
      const { html } = linkifyHtmlContent(
        '<p>Se <a class="ref" href="/some/path">lagen (1982:673)</a>.</p>',
        defaultMap
      )
      expect(html).toContain('class="legal-ref"')
      expect(html).toContain('href="/lagar/arbetstidslag-1982-673"')
      expect(html).not.toContain('class="ref"')
    })

    it('unwraps class="change-sfs-nr" links exposing förordning refs', () => {
      const { html } = linkifyHtmlContent(
        '<p><a class="change-sfs-nr" href="/rn/sfs.aspx">Förordning (2012:295)</a></p>',
        defaultMap
      )
      expect(html).toContain('class="legal-ref"')
      expect(html).not.toContain('class="change-sfs-nr"')
    })

    it('preserves .paragraf section anchors', () => {
      const { html } = linkifyHtmlContent(
        '<p><a class="paragraf" name="K1P1" id="K1P1"><b>1 §</b></a> Se lagen (1982:673).</p>',
        defaultMap
      )
      expect(html).toContain('class="paragraf"')
      expect(html).toContain('class="legal-ref"')
    })

    it('preserves name-only anchors (no href)', () => {
      const { html } = linkifyHtmlContent(
        '<p><a name="section-marker"></a>Se lagen (1982:673).</p>',
        defaultMap
      )
      expect(html).toContain('name="section-marker"')
      expect(html).toContain('class="legal-ref"')
    })
  })

  describe('section deep-linking', () => {
    it('appends #K{n}P{n} for chapter + section references', () => {
      const { html } = linkifyHtmlContent(
        '<p>Se 2 kap. 3 § lagen (2012:295).</p>',
        defaultMap
      )
      expect(html).toContain('href="/lagar/some-law-2012-295#K2P3"')
    })

    it('appends #P{n} for section-only references', () => {
      const { html } = linkifyHtmlContent(
        '<p>Se 5 § lagen (2012:295).</p>',
        defaultMap
      )
      expect(html).toContain('href="/lagar/some-law-2012-295#P5"')
    })

    it('no fragment for bare law reference', () => {
      const { html } = linkifyHtmlContent(
        '<p>Se lagen (2012:295).</p>',
        defaultMap
      )
      expect(html).toContain('href="/lagar/some-law-2012-295"')
      expect(html).not.toContain('#K')
      expect(html).not.toContain('#P')
    })
  })

  describe('compound law names', () => {
    it('linkifies compound law name: "aktiebolagslagen (2012:295)"', () => {
      const { html } = linkifyHtmlContent(
        '<p>Se aktiebolagslagen (2012:295).</p>',
        defaultMap
      )
      expect(html).toContain('class="legal-ref"')
      expect(html).toContain('>aktiebolagslagen (2012:295)</a>')
    })

    it('linkifies compound law unwrapped from Riksdagen link', () => {
      const { html } = linkifyHtmlContent(
        '<p>Se <a class="ref" href="/rn/goext.aspx?id=SFS:2012:295">aktiebolagslagen (2012:295)</a>.</p>',
        defaultMap
      )
      expect(html).toContain('class="legal-ref"')
      expect(html).toContain('>aktiebolagslagen (2012:295)</a>')
      expect(html).not.toContain('class="ref"')
    })

    it('merges compound prefix split by Riksdagen <a> tag', () => {
      // Real-world case: Riksdagen wraps "lagen (2012:295)" in <a> but leaves prefix outside
      const { html } = linkifyHtmlContent(
        '<p>enligt aktiebolags<a class="ref" href="/rn/goext.aspx">lagen (2012:295)</a> anges</p>',
        defaultMap
      )
      expect(html).toContain('>aktiebolagslagen (2012:295)</a>')
      expect(html).not.toContain('class="ref"')
    })
  })

  describe('edge cases', () => {
    it('handles empty HTML', () => {
      const { html } = linkifyHtmlContent('', defaultMap)
      expect(html).toBe('')
    })

    it('handles HTML with no text nodes', () => {
      const { html } = linkifyHtmlContent('<div><br/><hr/></div>', defaultMap)
      expect(html).toContain('<div>')
    })

    it('handles deeply nested HTML', () => {
      const { html } = linkifyHtmlContent(
        '<div><section><article><p>Se lagen (1982:673).</p></article></section></div>',
        defaultMap
      )
      expect(html).toContain('class="legal-ref"')
    })
  })
})
