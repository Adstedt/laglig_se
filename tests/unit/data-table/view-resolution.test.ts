/**
 * Story 28.1: view-resolution unit tests — force/ssrDefault/hysteresis.
 * The hysteresis band is the anti-oscillation guarantee: the table↔card
 * swap can toggle a ~17px scrollbar, so card→table must not flip back
 * until width clears cardBelow + VIEW_HYSTERESIS_PX.
 */
import { describe, expect, it } from 'vitest'
import {
  DEFAULT_CARD_BELOW,
  VIEW_HYSTERESIS_PX,
  resolveView,
} from '@/components/ui/data-table/view-resolution'

describe('resolveView', () => {
  it('force wins over everything', () => {
    expect(resolveView(200, { force: 'table' }, 'card')).toBe('table')
    expect(resolveView(2000, { force: 'card' }, 'table')).toBe('card')
    expect(resolveView(null, { force: 'card' }, null)).toBe('card')
  })

  it('cardBelow: false always renders table', () => {
    expect(resolveView(100, { cardBelow: false }, 'card')).toBe('table')
    expect(resolveView(null, { cardBelow: false }, null)).toBe('table')
  })

  it('unmeasured width uses ssrDefault, defaulting to table', () => {
    expect(resolveView(null, undefined, null)).toBe('table')
    expect(resolveView(null, { ssrDefault: 'card' }, null)).toBe('card')
  })

  it('first measure resolves by the raw breakpoint', () => {
    expect(resolveView(DEFAULT_CARD_BELOW - 1, undefined, null)).toBe('card')
    expect(resolveView(DEFAULT_CARD_BELOW, undefined, null)).toBe('table')
  })

  it('table→card flips below the breakpoint', () => {
    expect(resolveView(DEFAULT_CARD_BELOW - 1, undefined, 'table')).toBe('card')
    expect(resolveView(DEFAULT_CARD_BELOW, undefined, 'table')).toBe('table')
  })

  it('card→table waits for the hysteresis band', () => {
    // Inside the band: stays card even though width >= breakpoint.
    expect(resolveView(DEFAULT_CARD_BELOW, undefined, 'card')).toBe('card')
    expect(
      resolveView(
        DEFAULT_CARD_BELOW + VIEW_HYSTERESIS_PX - 1,
        undefined,
        'card'
      )
    ).toBe('card')
    // Clears the band: flips back.
    expect(
      resolveView(DEFAULT_CARD_BELOW + VIEW_HYSTERESIS_PX, undefined, 'card')
    ).toBe('table')
  })

  it('no oscillation across a scrollbar-width bounce', () => {
    // Simulate: table at 650 → card content grows → scrollbar appears,
    // width drops 17px → grows back. The view must be stable through it.
    let view = resolveView(650, undefined, 'table')
    expect(view).toBe('table')
    view = resolveView(630, undefined, view) // squeeze below 640
    expect(view).toBe('card')
    view = resolveView(647, undefined, view) // scrollbar gone, +17px bounce
    expect(view).toBe('card') // inside band — no flap
    view = resolveView(630, undefined, view)
    expect(view).toBe('card')
  })

  it('respects a custom cardBelow breakpoint', () => {
    expect(resolveView(700, { cardBelow: 768 }, 'table')).toBe('card')
    expect(resolveView(780, { cardBelow: 768 }, 'card')).toBe('card') // band
    expect(
      resolveView(768 + VIEW_HYSTERESIS_PX, { cardBelow: 768 }, 'card')
    ).toBe('table')
  })
})
