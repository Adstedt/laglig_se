/**
 * Story 28.1: column-sizing clamp unit tests. The clamp-before-emit
 * contract is what keeps persisted stores valid: TanStack's onEnd resize
 * mode commits startSize + deltaOffset unclamped.
 */
import { describe, expect, it } from 'vitest'
import type { ColumnDef } from '@tanstack/react-table'
import {
  boundsFromColumnDefs,
  clampColumnSizing,
} from '@/components/ui/data-table/column-sizing'

interface Row {
  id: string
  title: string
  amount: number
}

const columns: ColumnDef<Row, unknown>[] = [
  {
    id: 'title',
    minSize: 150,
    maxSize: 600,
    meta: { dt: { label: 'Titel' } },
  },
  {
    accessorKey: 'amount',
    minSize: 80,
    maxSize: 200,
    meta: { dt: { label: 'Belopp', numeric: true } },
  },
  {
    id: 'status',
    // meta bounds override minSize/maxSize
    minSize: 10,
    maxSize: 1000,
    meta: { dt: { label: 'Status', bounds: { min: 120, max: 250 } } },
  },
  {
    id: 'unbounded',
    meta: { dt: { label: 'Fri' } },
  },
]

describe('boundsFromColumnDefs', () => {
  it('derives bounds from minSize/maxSize', () => {
    const bounds = boundsFromColumnDefs(columns)
    expect(bounds.title).toEqual({ min: 150, max: 600 })
  })

  it('resolves accessorKey columns without explicit id', () => {
    const bounds = boundsFromColumnDefs(columns)
    expect(bounds.amount).toEqual({ min: 80, max: 200 })
  })

  it('meta.dt.bounds wins over minSize/maxSize', () => {
    const bounds = boundsFromColumnDefs(columns)
    expect(bounds.status).toEqual({ min: 120, max: 250 })
  })

  it('unbounded columns get [0, Infinity]', () => {
    const bounds = boundsFromColumnDefs(columns)
    expect(bounds.unbounded).toEqual({
      min: 0,
      max: Number.POSITIVE_INFINITY,
    })
  })
})

describe('clampColumnSizing', () => {
  const bounds = boundsFromColumnDefs(columns)

  it('clamps at both edges', () => {
    expect(clampColumnSizing({ title: 10_000, amount: 3 }, bounds)).toEqual({
      title: 600,
      amount: 80,
    })
  })

  it('passes in-range values through', () => {
    expect(clampColumnSizing({ title: 300 }, bounds)).toEqual({ title: 300 })
  })

  it('leaves unknown column ids untouched (stale persisted keys)', () => {
    expect(clampColumnSizing({ ghost: 42 }, bounds)).toEqual({ ghost: 42 })
  })
})
