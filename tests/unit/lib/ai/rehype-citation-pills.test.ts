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
})
