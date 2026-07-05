/**
 * Unit tests: base→consolidated preamble merge (Story 2.6).
 */
import { describe, it, expect } from 'vitest'
import { mergeBasePreamble } from '../../../../lib/eu/merge-preamble'

const CONSOLIDATED = `<article class="legal-document" id="eu-x">
  <div class="lovhead"><h1>X</h1></div>
  <details class="preamble-accordion"><summary>Inledning och skäl</summary><div class="preamble"></div></details>
  <div class="body"><section class="kapitel"><h2>KAPITEL I</h2><p class="text">CONSOLIDATED body — article 9a added by amendment</p></section></div>
</article>`

const BASE = `<article class="legal-document" id="eu-x">
  <div class="lovhead"><h1>X</h1></div>
  <details class="preamble-accordion"><summary>Inledning och skäl</summary><div class="preamble"><p>(1) recital one</p><p>(2) recital two</p></div></details>
  <div class="body"><section class="kapitel"><h2>KAPITEL I</h2><p class="text">ORIGINAL body</p></section></div>
</article>`

describe('mergeBasePreamble', () => {
  it('replaces the hollow consolidated preamble with the base recitals, keeping the consolidated body', () => {
    const r = mergeBasePreamble(CONSOLIDATED, BASE)
    expect(r.merged).toBe(true)
    expect(r.recitalParas).toBe(2)
    expect(r.html).toContain('recital one')
    expect(r.html).toContain('recital two')
    // consolidated body preserved…
    expect(r.html).toContain(
      'CONSOLIDATED body — article 9a added by amendment'
    )
    // …and the base act's (stale) body is NOT pulled in
    expect(r.html).not.toContain('ORIGINAL body')
  })

  it('inserts the base preamble after the header when consolidated has none', () => {
    const noPreamble = CONSOLIDATED.replace(
      /<details class="preamble-accordion">.*?<\/details>/s,
      ''
    )
    const r = mergeBasePreamble(noPreamble, BASE)
    expect(r.merged).toBe(true)
    expect(r.html).toContain('preamble-accordion')
    expect(r.html).toContain('recital one')
    // preamble sits before the body
    expect(r.html.indexOf('preamble-accordion')).toBeLessThan(
      r.html.indexOf('class="body"')
    )
  })

  it('is a no-op when the base act has no preamble', () => {
    const baseNoPreamble = BASE.replace(
      /<details class="preamble-accordion">.*?<\/details>/s,
      ''
    )
    const r = mergeBasePreamble(CONSOLIDATED, baseNoPreamble)
    expect(r.merged).toBe(false)
    expect(r.recitalParas).toBe(0)
    expect(r.html).toBe(CONSOLIDATED)
  })
})
