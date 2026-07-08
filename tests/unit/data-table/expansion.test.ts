/**
 * Story 28.1: render-item flattening — the expansion × virtualization fix.
 * Detail entries must be their own items with stable keys so the
 * virtualizer measures them independently of the fixed row estimate.
 */
import { describe, expect, it } from 'vitest'
import type { Row } from '@tanstack/react-table'
import {
  DETAIL_KEY_SUFFIX,
  buildRenderItems,
} from '@/components/ui/data-table/features/expansion'

function fakeRow(id: string, expanded: boolean): Row<{ id: string }> {
  return {
    id,
    getIsExpanded: () => expanded,
  } as unknown as Row<{ id: string }>
}

describe('buildRenderItems', () => {
  it('maps rows 1:1 when expansion is off, even if rows report expanded', () => {
    const rows = [fakeRow('a', true), fakeRow('b', false)]
    const items = buildRenderItems(rows, false)
    expect(items).toHaveLength(2)
    expect(items.every((i) => i.kind === 'row')).toBe(true)
  })

  it('inserts a detail item directly after each expanded row', () => {
    const rows = [fakeRow('a', false), fakeRow('b', true), fakeRow('c', false)]
    const items = buildRenderItems(rows, true)
    expect(items.map((i) => i.key)).toEqual([
      'a',
      'b',
      `b${DETAIL_KEY_SUFFIX}`,
      'c',
    ])
    expect(items[2]?.kind).toBe('detail')
    expect(items[2]?.row.id).toBe('b')
  })

  it('handles all rows expanded (worst case for the estimate)', () => {
    const rows = [fakeRow('a', true), fakeRow('b', true)]
    const items = buildRenderItems(rows, true)
    expect(items).toHaveLength(4)
    expect(items.filter((i) => i.kind === 'detail')).toHaveLength(2)
  })

  it('detail keys are stable and derived from row ids', () => {
    const items = buildRenderItems([fakeRow('x', true)], true)
    expect(items[1]?.key).toBe(`x${DETAIL_KEY_SUFFIX}`)
  })
})
