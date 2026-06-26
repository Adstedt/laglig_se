import { describe, it, expect } from 'vitest'
import {
  buildCurrentSnapshots,
  type SkolfsStatuteHit,
} from '@/lib/agency/skolfs-api'

const hit = (over: Partial<SkolfsStatuteHit>): SkolfsStatuteHit => ({
  skolfsNumber: '2024:616',
  baseSkolfsNumber: '2024:616',
  statuteTitle: 'Test',
  documentType: 'GRUNDFORFATTNING',
  validity: 'VALID',
  ...over,
})

describe('buildCurrentSnapshots', () => {
  it('projects a base with its amendment chain and consolidation flag', () => {
    const hits: SkolfsStatuteHit[] = [
      hit({ skolfsNumber: '2024:616', baseSkolfsNumber: '2024:616' }),
      hit({
        skolfsNumber: '2025:449',
        baseSkolfsNumber: '2024:616',
        documentType: 'ANDRINGSFORFATTNING',
        validity: 'VALID',
      }),
      hit({
        skolfsNumber: '2024:617',
        baseSkolfsNumber: '2024:616',
        documentType: 'ANDRINGSFORFATTNING',
        validity: 'UPCOMING',
      }),
      hit({
        skolfsNumber: '2024:616',
        baseSkolfsNumber: '2024:616',
        documentType: 'SENASTE_LYDELSE',
        validity: 'VALID',
      }),
    ]
    const snaps = buildCurrentSnapshots(hits)
    const s = snaps.get('SKOLFS 2024:616')
    expect(s).toBeDefined()
    expect(s!.validity).toBe('VALID')
    expect(s!.isConsolidated).toBe(true)
    expect(s!.amendmentChain).toHaveLength(2)
    expect(s!.upcoming).toEqual([
      {
        skolfsNumber: '2024:617',
        validity: 'UPCOMING',
        effectiveDate: null,
        change: null,
      },
    ])
  })

  it('includes EXPIRED bases so repeals are visible, excludes amendment acts as bases', () => {
    const hits: SkolfsStatuteHit[] = [
      hit({
        skolfsNumber: '2010:1',
        baseSkolfsNumber: '2010:1',
        validity: 'EXPIRED',
      }),
      hit({
        skolfsNumber: '2011:5',
        baseSkolfsNumber: '2010:1',
        documentType: 'ANDRINGSFORFATTNING',
        validity: 'VALID',
      }),
    ]
    const snaps = buildCurrentSnapshots(hits)
    expect(snaps.has('SKOLFS 2010:1')).toBe(true)
    expect(snaps.get('SKOLFS 2010:1')!.validity).toBe('EXPIRED')
    // the amendment act itself is not a standalone base
    expect(snaps.has('SKOLFS 2011:5')).toBe(false)
  })

  it('includes ALLMANNA_RAD_OVRIGT bases', () => {
    const snaps = buildCurrentSnapshots([
      hit({
        skolfsNumber: '2022:417',
        baseSkolfsNumber: '2022:417',
        documentType: 'ALLMANNA_RAD_OVRIGT',
      }),
    ])
    expect(snaps.has('SKOLFS 2022:417')).toBe(true)
  })
})
