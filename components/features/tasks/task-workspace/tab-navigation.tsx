'use client'

/**
 * Story 6.4: Task Workspace Tab Navigation
 * Horizontal tab bar with URL persistence
 */

import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { BarChart3, LayoutGrid, List, Calendar, Clock } from 'lucide-react'

export type TaskTab =
  | 'sammanfattning'
  | 'aktiva'
  | 'lista'
  | 'kalender'
  | 'alla'

const TABS = [
  { value: 'sammanfattning', label: 'Sammanfattning', icon: BarChart3 },
  { value: 'aktiva', label: 'Aktiva', icon: LayoutGrid },
  { value: 'lista', label: 'Lista', icon: List },
  { value: 'kalender', label: 'Kalender', icon: Calendar },
  { value: 'alla', label: 'Alla uppgifter', icon: Clock },
] as const

interface TabNavigationProps {
  currentTab: TaskTab
}

export function TabNavigation({ currentTab }: TabNavigationProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const handleTabChange = (value: string) => {
    const params = new URLSearchParams(searchParams.toString())
    params.set('tab', value)
    router.push(`${pathname}?${params.toString()}`, { scroll: false })
  }

  return (
    <Tabs value={currentTab} onValueChange={handleTabChange}>
      <TabsList className="h-auto p-1 bg-muted/50 overflow-x-auto flex-wrap sm:flex-nowrap">
        {TABS.map(({ value, label, icon: Icon }) => (
          <TabsTrigger
            key={value}
            value={value}
            className="data-[state=active]:bg-background gap-2 whitespace-nowrap"
          >
            <Icon className="h-4 w-4" />
            <span className="hidden sm:inline">{label}</span>
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  )
}
