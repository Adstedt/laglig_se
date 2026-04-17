'use client'

import { useEffect } from 'react'
import { useBreadcrumbOverrideStore } from '@/lib/stores/breadcrumb-override-store'

interface BreadcrumbOverrideProps {
  label: string
}

export function BreadcrumbOverride({ label }: BreadcrumbOverrideProps) {
  const setLabel = useBreadcrumbOverrideStore((s) => s.setLabel)

  useEffect(() => {
    setLabel(label)
    return () => setLabel(null)
  }, [label, setLabel])

  return null
}
