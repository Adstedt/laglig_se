'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Switch } from '@/components/ui/switch'

export function AutoRefreshToggle() {
  const router = useRouter()
  const [enabled, setEnabled] = useState(false)

  useEffect(() => {
    if (!enabled) return
    const interval = setInterval(() => {
      router.refresh()
    }, 10_000)
    return () => clearInterval(interval)
  }, [enabled, router])

  return (
    <div className="flex items-center gap-2">
      <Switch checked={enabled} onCheckedChange={setEnabled} />
      <span className="text-sm text-muted-foreground">Autoförnya</span>
    </div>
  )
}
