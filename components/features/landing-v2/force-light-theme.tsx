'use client'

import * as React from 'react'
import { useTheme } from 'next-themes'

export function ForceLightTheme() {
  const { setTheme } = useTheme()
  React.useEffect(() => {
    setTheme('light')
  }, [setTheme])
  return null
}
