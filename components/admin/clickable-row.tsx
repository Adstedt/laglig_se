'use client'

import { useRouter } from 'next/navigation'
import { TableRow } from '@/components/ui/table'

export function ClickableRow({
  href,
  children,
}: {
  href: string
  children: React.ReactNode
}) {
  const router = useRouter()

  return (
    <TableRow className="cursor-pointer" onClick={() => router.push(href)}>
      {children}
    </TableRow>
  )
}
