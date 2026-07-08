'use client'

/**
 * Context bridging the headless core and the dumb renderers. Carries the
 * resolved config alongside the TanStack instance so renderers never
 * receive props of their own.
 */
import { createContext, useContext } from 'react'
import type { Table } from '@tanstack/react-table'
import type { DataTableProps, DataTableView, RenderItem } from './types'

export interface DataTableContextValue<TData> {
  table: Table<TData>
  view: DataTableView
  renderItems: RenderItem<TData>[]
  props: DataTableProps<TData>
  /** Measured container width (8px-quantized); null before first measure. */
  containerWidth: number | null
}

// Typed at use-site via the useDataTableContext<TData>() cast — a single
// context instance can't be generic in React.
const DataTableContext = createContext<DataTableContextValue<unknown> | null>(
  null
)

export const DataTableContextProvider = DataTableContext.Provider

export function useDataTableContext<TData>(): DataTableContextValue<TData> {
  const ctx = useContext(DataTableContext)
  if (!ctx) {
    throw new Error(
      'DataTable renderer components must be rendered inside <DataTable>'
    )
  }
  return ctx as DataTableContextValue<TData>
}
