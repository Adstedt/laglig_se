import { describe, it, expect } from 'vitest'
import { rehypeCitationPills } from '@/lib/ai/rehype-citation-pills'
import type { Root, Text, Element } from 'hast'

function makeTree(text: string): Root {
  return {
    type: 'root',
    children: [
      {
        type: 'element',
        tagName: 'p',
        properties: {},
        children: [{ type: 'text', value: text }],
      },
    ],
  }
}

function getChildren(tree: Root): (Text | Element)[] {
  const p = tree.children[0] as Element
  return p.children as (Text | Element)[]
}

describe('rehypeCitationPills', () => {
  const plugin = rehypeCitationPills()

  it('leaves plain text unchanged', () => {
    const tree = makeTree('Hello world')
    plugin(tree)
    const children = getChildren(tree)
    expect(children).toHaveLength(1)
    expect((children[0] as Text).value).toBe('Hello world')
  })

  it('transforms [Källa: X] into <cite> element', () => {
    const tree = makeTree('See [Källa: SFS 1977:1160] for details.')
    plugin(tree)
    const children = getChildren(tree)
    expect(children).toHaveLength(3)
    expect((children[0] as Text).value).toBe('See ')
    expect((children[1] as Element).tagName).toBe('cite')
    expect(((children[1] as Element).children[0] as Text).value).toBe(
      'SFS 1977:1160'
    )
    expect((children[2] as Text).value).toBe('for details.')
  })

  it('moves trailing punctuation BEFORE the citation pill', () => {
    const tree = makeTree('text [Källa: SFS 1977:1160]. More text.')
    plugin(tree)
    const children = getChildren(tree)
    // "text. " + <cite> + "More text."
    expect((children[0] as Text).value).toBe('text. ')
    expect((children[1] as Element).tagName).toBe('cite')
    expect((children[2] as Text).value).toBe('More text.')
  })

  it('handles citation at end of sentence with period', () => {
    const tree = makeTree(
      'ohälsa eller olycksfall [Källa: SFS 1977:1160, 3 kap. 2 §].'
    )
    plugin(tree)
    const children = getChildren(tree)
    // "ohälsa eller olycksfall. " + <cite>
    expect((children[0] as Text).value).toBe('ohälsa eller olycksfall. ')
    expect((children[1] as Element).tagName).toBe('cite')
    expect(((children[1] as Element).children[0] as Text).value).toBe(
      'SFS 1977:1160, 3 kap. 2 §'
    )
    expect(children).toHaveLength(2)
  })

  it('handles multiple citations in one text node', () => {
    const tree = makeTree('[Källa: SFS 1977:1160] and [Källa: AFS 2023:1].')
    plugin(tree)
    const children = getChildren(tree)
    const cites = children.filter(
      (c) => c.type === 'element' && c.tagName === 'cite'
    )
    expect(cites).toHaveLength(2)
  })

  it('handles citation with section reference', () => {
    const tree = makeTree('[Källa: SFS 1982:80, 7 §]')
    plugin(tree)
    const children = getChildren(tree)
    const cite = children.find(
      (c) => c.type === 'element' && c.tagName === 'cite'
    ) as Element
    expect(cite).toBeDefined()
    expect((cite.children[0] as Text).value).toBe('SFS 1982:80, 7 §')
  })

  it('does not transform partial citations', () => {
    const tree = makeTree('text [Källa: incomplete')
    plugin(tree)
    const children = getChildren(tree)
    // No closing bracket — text node unchanged
    expect(children).toHaveLength(1)
    expect((children[0] as Text).value).toBe('text [Källa: incomplete')
  })

  it('handles comma as trailing punctuation', () => {
    const tree = makeTree('lag [Källa: SFS 2018:2088], som reglerar')
    plugin(tree)
    const children = getChildren(tree)
    // "lag, " + <cite> + "som reglerar"
    expect((children[0] as Text).value).toBe('lag, ')
    expect((children[1] as Element).tagName).toBe('cite')
    expect((children[2] as Text).value).toBe('som reglerar')
  })

  // -------------------------------------------------------------------------
  // Story 17.10b: [Utkast: ...] form for DRAFT/IN_REVIEW styrdokument
  // -------------------------------------------------------------------------

  it('17.10b: transforms [Utkast: X] into <cite> with data-tier="draft" + preserves Utkast: prefix in chip text', () => {
    const tree = makeTree('Se [Utkast: Semesterpolicy] för mer info.')
    plugin(tree)
    const children = getChildren(tree)
    const cite = children.find(
      (c) => c.type === 'element' && c.tagName === 'cite'
    ) as Element
    expect(cite).toBeDefined()
    expect((cite.children[0] as Text).value).toBe('Utkast: Semesterpolicy')
    expect((cite.properties as { 'data-tier'?: string })['data-tier']).toBe(
      'draft'
    )
  })

  it('17.10b: [Källa: X] gets data-tier="canonical" (existing chip stays bare-label)', () => {
    const tree = makeTree('Se [Källa: Dataskyddspolicy] för detaljer.')
    plugin(tree)
    const children = getChildren(tree)
    const cite = children.find(
      (c) => c.type === 'element' && c.tagName === 'cite'
    ) as Element
    // Källa pill text is bare (no prefix), tier = canonical.
    expect((cite.children[0] as Text).value).toBe('Dataskyddspolicy')
    expect((cite.properties as { 'data-tier'?: string })['data-tier']).toBe(
      'canonical'
    )
  })

  it('17.10b: mixed Källa + Utkast in one text node produces two distinct cite tiers', () => {
    const tree = makeTree(
      'Er policy [Källa: GDPR-policy] kompletteras av [Utkast: Semesterpolicy].'
    )
    plugin(tree)
    const children = getChildren(tree)
    const cites = children.filter(
      (c) => c.type === 'element' && c.tagName === 'cite'
    ) as Element[]
    expect(cites).toHaveLength(2)
    expect(
      (cites[0]!.properties as { 'data-tier'?: string })['data-tier']
    ).toBe('canonical')
    expect((cites[0]!.children[0] as Text).value).toBe('GDPR-policy')
    expect(
      (cites[1]!.properties as { 'data-tier'?: string })['data-tier']
    ).toBe('draft')
    expect((cites[1]!.children[0] as Text).value).toBe('Utkast: Semesterpolicy')
  })

  it('17.10b: does not transform partial [Utkast: ...', () => {
    const tree = makeTree('text [Utkast: incomplete')
    plugin(tree)
    const children = getChildren(tree)
    expect(children).toHaveLength(1)
    expect((children[0] as Text).value).toBe('text [Utkast: incomplete')
  })

  // ==========================================================================
  // Story 17.18 AC 8 — SF-2 draft citationKey "(utkast vN)" suffix verify-only
  // ==========================================================================
  //
  // The existing 17.10b regex matches everything inside the [Utkast: ...]
  // brackets, including parentheses for the version suffix. No regex change
  // is required — the version suffix renders naturally inside the pill text.
  // This test locks the verified behavior so a future regex tightening can't
  // silently regress the SF-2 shape.

  it('Story 17.18 SF-2: draft citationKey with (utkast vN) suffix renders inline', () => {
    const tree = makeTree(
      'Er Arbetsmiljöpolicy kräver årlig riskbedömning[Utkast: Arbetsmiljöpolicy (utkast v9)].'
    )
    plugin(tree)

    const children = getChildren(tree)
    const cite = children.find(
      (c): c is Element => 'tagName' in c && c.tagName === 'cite'
    )!
    expect(cite).toBeDefined()
    // The version suffix renders as part of the pill text.
    expect((cite.children[0] as Text).value).toBe(
      'Utkast: Arbetsmiljöpolicy (utkast v9)'
    )
    expect((cite.properties as { 'data-tier'?: string })['data-tier']).toBe(
      'draft'
    )
  })

  it('Story 17.18 SF-2: paired Källa + Utkast (utkast vN) for the SAME doc renders two distinct cites', () => {
    // The dual-state grounding pattern from the system prompt — same doc,
    // both tiers cited within one sentence. Each pill must carry its own
    // data-tier so the chip renderer applies distinct styling.
    const tree = makeTree(
      'Er Arbetsmiljöpolicy[Källa: Arbetsmiljöpolicy] uppdateras i ett utkast[Utkast: Arbetsmiljöpolicy (utkast v9)].'
    )
    plugin(tree)

    const children = getChildren(tree)
    const cites = children.filter(
      (c): c is Element => 'tagName' in c && c.tagName === 'cite'
    )
    expect(cites).toHaveLength(2)
    expect(
      (cites[0]!.properties as { 'data-tier'?: string })['data-tier']
    ).toBe('canonical')
    expect((cites[0]!.children[0] as Text).value).toBe('Arbetsmiljöpolicy')
    expect(
      (cites[1]!.properties as { 'data-tier'?: string })['data-tier']
    ).toBe('draft')
    expect((cites[1]!.children[0] as Text).value).toBe(
      'Utkast: Arbetsmiljöpolicy (utkast v9)'
    )
  })
})
