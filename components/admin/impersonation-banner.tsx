'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { endImpersonation } from '@/app/actions/admin-impersonate'

interface ImpersonationBannerProps {
  userName: string
  userEmail: string
  userId: string
}

export function ImpersonationBanner({
  userName,
  userEmail,
  userId,
}: ImpersonationBannerProps) {
  const [loading, setLoading] = useState(false)

  async function handleReturn() {
    setLoading(true)
    try {
      const result = await endImpersonation()
      if (result.success) {
        window.location.href = `/admin/users/${userId}`
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <div className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between bg-destructive px-4 py-2 text-destructive-foreground">
        <span className="text-sm font-medium">
          Du är inloggad som {userName} ({userEmail})
        </span>
        <Button
          variant="secondary"
          size="sm"
          onClick={handleReturn}
          disabled={loading}
        >
          {loading ? 'Avslutar...' : 'Tillbaka till admin'}
        </Button>
      </div>
      {/* Spacer to push content below the fixed banner */}
      <div className="h-10" />
    </>
  )
}
