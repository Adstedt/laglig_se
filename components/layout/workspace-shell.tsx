'use client'

import { LeftSidebar } from '@/components/layout/left-sidebar'
import { MobileSidebar } from '@/components/layout/mobile-sidebar'
import { Header } from '@/components/layout/header'
import { RightSidebar } from '@/components/layout/right-sidebar'
import { useLayoutStore } from '@/lib/stores/layout-store'
import { useEffect, useState } from 'react'

interface WorkspaceShellProps {
  user: {
    name?: string | null
    email?: string | null
    image?: string | null
  }
  children: React.ReactNode
}

export function WorkspaceShell({ user, children }: WorkspaceShellProps) {
  const { rightSidebarFolded, toggleRightSidebar } = useLayoutStore()
  const [leftSidebarCollapsed, setLeftSidebarCollapsed] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  // Keyboard shortcut for toggling right sidebar (Cmd/Ctrl + K or /)
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Cmd/Ctrl + K
      if (event.key === 'k' && (event.metaKey || event.ctrlKey)) {
        event.preventDefault()
        toggleRightSidebar()
      }
      // Forward slash (/) when not in an input
      if (
        event.key === '/' &&
        !['INPUT', 'TEXTAREA'].includes(
          (event.target as HTMLElement)?.tagName || ''
        )
      ) {
        event.preventDefault()
        toggleRightSidebar()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [toggleRightSidebar])

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      {/* Full-width header at top */}
      <Header user={user} onMenuToggle={() => setMobileMenuOpen(true)} />

      {/* Mobile sidebar drawer */}
      <MobileSidebar open={mobileMenuOpen} onOpenChange={setMobileMenuOpen} />

      {/* Content area below header */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Sidebar - desktop only */}
        <LeftSidebar
          collapsed={leftSidebarCollapsed}
          onToggle={() => setLeftSidebarCollapsed(!leftSidebarCollapsed)}
        />

        {/* Main content */}
        <main className="flex-1 overflow-auto bg-muted/30 p-4 md:p-6">
          {children}
        </main>

        {/* Right Sidebar - desktop only */}
        <RightSidebar
          isOpen={!rightSidebarFolded}
          onToggle={toggleRightSidebar}
        />
      </div>
    </div>
  )
}
