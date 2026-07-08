import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { DataTableDemoClient } from './data-table-demo-client'

/**
 * Story 28.1 harness: exercises the unified DataTable core (sorting,
 * selection, column state, expansion × virtualization, container-width
 * card switch) against synthetic data. Same availability rules as the
 * styleguide index: dev + preview only, never production.
 */
export const metadata: Metadata = {
  title: 'DataTable-harness',
  robots: { index: false, follow: false },
}

export default function DataTableDemoPage() {
  if (process.env.VERCEL_ENV === 'production') {
    notFound()
  }

  return <DataTableDemoClient />
}
