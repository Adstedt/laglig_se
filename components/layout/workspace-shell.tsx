'use client'

import { LeftSidebar } from '@/components/layout/left-sidebar'
import { MobileSidebar } from '@/components/layout/mobile-sidebar'
import { Header } from '@/components/layout/header'
import { RightSidebar } from '@/components/layout/right-sidebar'
import { ChatModal } from '@/components/features/ai-chat/chat-modal'
import { Breadcrumbs } from '@/components/layout/breadcrumbs'
import { useLayoutStore } from '@/lib/stores/layout-store'
import { WorkspaceProvider } from '@/hooks/use-workspace'
import { Toaster } from '@/components/ui/sonner'
import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { useMediaQuery } from '@/lib/hooks/use-media-query'

interface WorkspaceShellProps {
  user: {
    name?: string | null
    email?: string | null
    image?: string | null
  }
  children: React.ReactNode
}

export function WorkspaceShell({ user, children }: WorkspaceShellProps) {
  const {
    rightSidebarFolded,
    toggleRightSidebar,
    setRightSidebarFolded,
    toggleLeftSidebar,
  } = useLayoutStore()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const pathname = usePathname()

  // Detect mobile/tablet (below lg breakpoint where RightSidebar is hidden)
  const isMobile = useMediaQuery('(max-width: 1023px)')

  // Auto-close right sidebar on /dashboard — Hem page IS the chat
  useEffect(() => {
    if (pathname === '/dashboard' && !rightSidebarFolded) {
      setRightSidebarFolded(true)
    }
  }, [pathname, rightSidebarFolded, setRightSidebarFolded])

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Cmd/Ctrl + K — toggle right sidebar (AI chat)
      if (event.key === 'k' && (event.metaKey || event.ctrlKey)) {
        event.preventDefault()
        toggleRightSidebar()
      }
      // Forward slash (/) when not in an input — toggle right sidebar
      if (
        event.key === '/' &&
        !['INPUT', 'TEXTAREA'].includes(
          (event.target as HTMLElement)?.tagName || ''
        )
      ) {
        event.preventDefault()
        toggleRightSidebar()
      }
      // Cmd/Ctrl + B — toggle left sidebar collapse
      if (event.key === 'b' && (event.metaKey || event.ctrlKey)) {
        event.preventDefault()
        toggleLeftSidebar()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [toggleRightSidebar, toggleLeftSidebar])

  return (
    <WorkspaceProvider>
      <Toaster position="top-right" richColors />
      {/* Row-first layout: sidebar | column(header + content) */}
      <div className="flex h-screen overflow-hidden">
        {/* Left Sidebar - full height, desktop only */}
        <LeftSidebar user={user} />

        {/* Right column: header + content */}
        <div className="flex flex-1 flex-col overflow-hidden">
          {/* Header - starts where sidebar ends */}
          <Header user={user} onMenuToggle={() => setMobileMenuOpen(true)} />

          {/* Mobile sidebar drawer */}
          <MobileSidebar
            open={mobileMenuOpen}
            onOpenChange={setMobileMenuOpen}
            user={user}
          />

          {/* Content area below header */}
          <div className="flex flex-1 overflow-hidden">
            {/* Main content */}
            <main className="flex-1 overflow-auto bg-muted/30 p-4 md:p-6">
              <Breadcrumbs />
              {children}
            </main>

            {/* Right Sidebar - desktop only */}
            <RightSidebar
              isOpen={!rightSidebarFolded}
              onToggle={toggleRightSidebar}
            />
          </div>
        </div>
      </div>

      {/* Chat Modal - mobile only */}
      {isMobile && (
        <ChatModal
          isOpen={!rightSidebarFolded}
          onClose={() => setRightSidebarFolded(true)}
        />
      )}
    </WorkspaceProvider>
  )
}
