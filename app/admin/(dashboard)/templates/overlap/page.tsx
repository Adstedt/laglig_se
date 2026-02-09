import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'

import { TemplateOverlapTable } from '@/components/admin/template-overlap-table'
import { getTemplateOverlap } from '@/lib/admin/template-queries'

export const dynamic = 'force-dynamic'

export default async function TemplateOverlapPage() {
  const data = await getTemplateOverlap()

  const inconsistencyCount = data.filter((d) => d.isInconsistent).length

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link
          href="/admin/templates"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Tillbaka
        </Link>
        <h1 className="text-2xl font-bold">Dokumentöverlapp</h1>
      </div>

      {data.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <p className="text-muted-foreground">
            Inga dokument finns i fler än en mall
          </p>
          <Link
            href="/admin/templates"
            className="mt-4 text-sm underline hover:text-foreground"
          >
            Tillbaka till mallar
          </Link>
        </div>
      ) : (
        <>
          <div className="flex gap-6 text-sm text-muted-foreground">
            <span>
              <strong className="text-foreground">{data.length}</strong>{' '}
              överlappande dokument
            </span>
            <span>
              <strong className="text-foreground">{inconsistencyCount}</strong>{' '}
              inkonsekvenser
            </span>
          </div>

          <TemplateOverlapTable data={data} />
        </>
      )}
    </div>
  )
}
