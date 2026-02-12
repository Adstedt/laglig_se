'use client'

/**
 * Story 6.7: Added "+ Skapa" button and Ctrl+Shift+T shortcut for global task creation
 */

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Search, Bell, Menu, Plus } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { CreateTaskModal } from '@/components/features/tasks/create-task-modal'
import { useGlobalKeyboardShortcuts } from '@/lib/hooks/use-global-keyboard-shortcuts'

interface HeaderProps {
  user: {
    id?: string
    name?: string | null
    email?: string | null
    image?: string | null
  }
  onMenuToggle?: () => void
}

export function Header({ user, onMenuToggle }: HeaderProps) {
  const router = useRouter()

  // Story 6.7: Global task creation modal state
  const [createTaskModalOpen, setCreateTaskModalOpen] = useState(false)

  // Story 6.7: Handler for opening modal (used by both button and keyboard shortcut)
  const handleOpenCreateTaskModal = useCallback(() => {
    setCreateTaskModalOpen(true)
  }, [])

  // Story 6.7: Refresh page data when task is created from header
  const handleTaskCreated = useCallback(() => {
    router.refresh()
  }, [router])

  // Story 6.7: Register global keyboard shortcut (Ctrl+Shift+T / Cmd+Shift+T)
  useGlobalKeyboardShortcuts({
    onQuickTaskCreate: handleOpenCreateTaskModal,
  })

  return (
    <>
      <header className="sticky top-0 z-50 flex h-[60px] shrink-0 items-center border-b bg-background px-4">
        {/* Mobile menu toggle */}
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden"
          onClick={onMenuToggle}
        >
          <Menu className="h-5 w-5" />
          <span className="sr-only">Meny</span>
        </Button>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Story 6.7: Global task creation button */}
        <Button
          size="sm"
          className="h-9"
          onClick={() => setCreateTaskModalOpen(true)}
        >
          <Plus className="h-4 w-4 mr-1" />
          Skapa
        </Button>

        {/* Global Search Placeholder */}
        <div className="relative hidden w-72 lg:block ml-4">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Sök lagar, rättsfall..."
            className="h-9 pl-9 bg-muted/50 border-0 focus-visible:bg-background focus-visible:ring-1"
            disabled
            title="Sökning kommer snart"
          />
        </div>

        {/* Notification Bell Placeholder */}
        <Button
          variant="ghost"
          size="icon"
          className="relative h-9 w-9 ml-2"
          disabled
          title="Notifieringar kommer snart"
        >
          <Bell className="h-5 w-5 text-muted-foreground" />
          <span className="sr-only">Notifieringar</span>
        </Button>
      </header>

      {/* Story 6.7: Global Task Creation Modal */}
      <CreateTaskModal
        open={createTaskModalOpen}
        onOpenChange={setCreateTaskModalOpen}
        currentUserId={user.id}
        onTaskCreated={handleTaskCreated}
      />
    </>
  )
}
