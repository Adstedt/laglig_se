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
    id?: string
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

  // On /dashboard the Hem page IS the chat — sidebar should never show
  const isHemPage = pathname === '/dashboard'

  // Sync store when navigating to /dashboard (so it stays closed after leaving)
  useEffect(() => {
    if (isHemPage && !rightSidebarFolded) {
      setRightSidebarFolded(true)
    }
  }, [isHemPage, rightSidebarFolded, setRightSidebarFolded])

  // Keyboard shortcuts
  useEffect(() => {
    // Detect editable typing context robustly. The naive tagName check
    // misses rich-text editors like Tiptap/ProseMirror where the editable
    // region is a <div contenteditable="true">. We check both event.target
    // and document.activeElement, and use closest('[contenteditable]') to
    // catch any descendant of an editable region.
    const isEditableContext = (el: unknown): boolean => {
      if (!el || typeof el !== 'object') return false
      const element = el as HTMLElement
      if (!element.tagName) return false
      if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA') {
        return true
      }
      if (element.isContentEditable) return true
      if (
        typeof element.closest === 'function' &&
        element.closest('[contenteditable="true"], [contenteditable=""]') !==
          null
      ) {
        return true
      }
      return false
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      // Cmd/Ctrl + K — toggle right sidebar (AI chat)
      if (event.key === 'k' && (event.metaKey || event.ctrlKey)) {
        event.preventDefault()
        toggleRightSidebar()
      }
      // Forward slash (/) when not typing in any editable context — toggle right sidebar
      if (
        event.key === '/' &&
        !isEditableContext(event.target) &&
        !isEditableContext(document.activeElement)
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
      <Toaster position="bottom-center" />
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

            {/* Right Sidebar - desktop only, hidden on Hem page */}
            <RightSidebar
              isOpen={!isHemPage && !rightSidebarFolded}
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
