/**
 * Story 28.1: smoke render tests for <DataTable> — catches render-phase
 * state loops and verifies both renderers mount.
 */
import { beforeAll, describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import type { ColumnDef } from '@tanstack/react-table'
import { DataTable } from '@/components/ui/data-table'

interface Row {
  id: string
  title: string
  status: string
}

const columns: ColumnDef<Row, unknown>[] = [
  {
    accessorKey: 'title',
    header: 'Titel',
    meta: { dt: { label: 'Titel', card: { role: 'title' } } },
  },
  {
    accessorKey: 'status',
    header: 'Status',
    meta: { dt: { label: 'Status', card: { role: 'badge' } } },
  },
]

const data: Row[] = [
  { id: 'a', title: 'Alpha', status: 'Uppfylld' },
  { id: 'b', title: 'Beta', status: 'Ej uppfylld' },
]

beforeAll(() => {
  // happy-dom lacks ResizeObserver
  if (typeof globalThis.ResizeObserver === 'undefined') {
    globalThis.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    } as unknown as typeof ResizeObserver
  }
})

describe('<DataTable>', () => {
  it('renders the table view without render loops', () => {
    render(
      <DataTable<Row>
        data={data}
        columns={columns}
        getRowId={(row) => row.id}
        view={{ force: 'table' }}
      />
    )
    expect(screen.getByText('Alpha')).toBeDefined()
    expect(screen.getByText('Beta')).toBeDefined()
  })

  it('renders the card view without render loops', () => {
    render(
      <DataTable<Row>
        data={data}
        columns={columns}
        getRowId={(row) => row.id}
        view={{ force: 'card' }}
      />
    )
    expect(screen.getByText('Alpha')).toBeDefined()
  })

  it('renders empty state when data is empty', () => {
    render(
      <DataTable<Row> data={[]} columns={columns} getRowId={(row) => row.id} />
    )
    expect(screen.getByText('Här är det tomt än så länge.')).toBeDefined()
  })

  it('renders with sorting + selection + expansion enabled', () => {
    const selected = new Set<string>()
    render(
      <DataTable<Row>
        data={data}
        columns={columns}
        getRowId={(row) => row.id}
        view={{ force: 'table' }}
        sorting={{ sorting: [], onSortingChange: () => {} }}
        selection={{ selected, onSelectedChange: () => {} }}
        expansion={{ renderExpanded: () => <div>detalj</div> }}
      />
    )
    expect(screen.getByText('Alpha')).toBeDefined()
  })
})

describe('<DataTable> demo-config reproduction', () => {
  const bigData: Row[] = Array.from({ length: 1000 }, (_, i) => ({
    id: `r${i}`,
    title: `Rad ${i}`,
    status: 'Uppfylld',
  }))

  // happy-dom has no layout, so the virtualizer measures a zero-height
  // scroll container and renders no rows — this test only guards against
  // render-phase state loops (the real-layout behavior is covered by the
  // /styleguide/data-table harness and the 28.3 Playwright suite).
  it('mounts 1000 virtualized rows with full feature config without looping', () => {
    const { container } = render(
      <DataTable<Row>
        data={bigData}
        columns={columns}
        getRowId={(row) => row.id}
        sorting={{ sorting: [], onSortingChange: () => {} }}
        selection={{ selected: new Set(), onSelectedChange: () => {} }}
        columnState={{
          visibility: {},
          onVisibilityChange: () => {},
          order: [],
          onOrderChange: () => {},
          sizing: {},
          onSizingChange: () => {},
        }}
        expansion={{ renderExpanded: () => <div>detalj</div> }}
        virtualization={{ maxHeight: 480 }}
      />
    )
    // happy-dom measures the container at 0px → the view legitimately
    // resolves to card (0 < 640); accept either renderer's root.
    expect(container.querySelector('table, [role="list"]')).not.toBeNull()
  })
})
