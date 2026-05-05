'use client'

/**
 * Story 6.7: Added "+ Skapa" button and Ctrl+Shift+T shortcut for global task creation
 * Story 22.10: "+ Skapa" button now opens a unified DropdownMenu with all top-level
 *             creation surfaces (Uppgift / Kontroll / Laglista / Dokument). Each
 *             item is permission-gated; the trigger button is hidden entirely when
 *             the user has no create permissions.
 */

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  Search,
  Menu,
  Plus,
  CheckSquare,
  ClipboardCheck,
  ListChecks,
  FileText,
} from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { CreateTaskModal } from '@/components/features/tasks/create-task-modal'
import { ManageListModal } from '@/components/features/document-list/manage-list-modal'
import { CreateDocumentDialog } from '@/components/features/documents/create-document-dialog'
import { useGlobalKeyboardShortcuts } from '@/lib/hooks/use-global-keyboard-shortcuts'
import { NotificationBell } from '@/components/features/notifications/notification-bell'
import { hasPermission } from '@/lib/auth/permissions'
import type { WorkspaceRole } from '@prisma/client'
import type { PublishedTemplate } from '@/lib/db/queries/template-catalog'

interface HeaderProps {
  user: {
    id?: string
    name?: string | null
    email?: string | null
    image?: string | null
  }
  role: WorkspaceRole
  publishedTemplates: PublishedTemplate[]
  onMenuToggle?: () => void
}

export function Header({
  user,
  role,
  publishedTemplates,
  onMenuToggle,
}: HeaderProps) {
  const router = useRouter()

  // Story 6.7: Global task creation modal state
  const [createTaskModalOpen, setCreateTaskModalOpen] = useState(false)
  // Story 22.10: Additional creation-surface modals reachable from the menu
  const [manageListModalOpen, setManageListModalOpen] = useState(false)
  const [createDocumentDialogOpen, setCreateDocumentDialogOpen] =
    useState(false)

  // Story 6.7: Handler for opening modal (used by both button and keyboard shortcut)
  const handleOpenCreateTaskModal = useCallback(() => {
    setCreateTaskModalOpen(true)
  }, [])

  // Story 6.7: Refresh page data when task is created from header
  const handleTaskCreated = useCallback(() => {
    router.refresh()
  }, [router])

  // Story 22.10: Refresh after laglista created so /laglistor (and any list view) updates
  const handleListCreated = useCallback(() => {
    setManageListModalOpen(false)
    router.refresh()
  }, [router])

  // Story 6.7: Register global keyboard shortcut (Ctrl+Shift+T / Cmd+Shift+T)
  // Story 22.10: Shortcut still routes directly to the task modal — bypassing the
  // new dropdown is intentional so power users keep the one-keystroke fast path.
  useGlobalKeyboardShortcuts({
    onQuickTaskCreate: handleOpenCreateTaskModal,
  })

  // Story 22.10: Permission gating — items hidden (not disabled) for roles
  // lacking the corresponding scope. AUDITOR (no create scopes) hides the
  // entire trigger button so an empty menu is never rendered.
  const canCreateTask = hasPermission(role, 'tasks:edit')
  // `canCreateKontroll` deliberately reads the same permission as `canCreateTask`
  // today (`tasks:edit`). Kept as a separate boolean so a future kontroll-specific
  // scope (e.g. `kontroll:create`) can be slotted in by changing one line.
  const canCreateKontroll = hasPermission(role, 'tasks:edit')
  const canCreateList = hasPermission(role, 'lists:create')
  const canCreateDocument = hasPermission(role, 'documents:add')
  const hasAnyCreatePermission =
    canCreateTask || canCreateKontroll || canCreateList || canCreateDocument

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

        {/* Story 22.10: Unified creation menu — trigger hidden for roles with
            zero create permissions (e.g. AUDITOR). */}
        {hasAnyCreatePermission && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" className="h-9">
                <Plus className="h-4 w-4 mr-1" />
                Skapa
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {canCreateTask && (
                <DropdownMenuItem onSelect={() => setCreateTaskModalOpen(true)}>
                  <CheckSquare className="h-4 w-4 mr-2" />
                  Uppgift
                </DropdownMenuItem>
              )}
              {canCreateKontroll && (
                <DropdownMenuItem
                  onSelect={() => router.push('/laglistor/kontroller/skapa')}
                >
                  <ClipboardCheck className="h-4 w-4 mr-2" />
                  Kontroll
                </DropdownMenuItem>
              )}
              {canCreateList && (
                <DropdownMenuItem onSelect={() => setManageListModalOpen(true)}>
                  <ListChecks className="h-4 w-4 mr-2" />
                  Laglista
                </DropdownMenuItem>
              )}
              {canCreateDocument && (
                <DropdownMenuItem
                  onSelect={() => setCreateDocumentDialogOpen(true)}
                >
                  <FileText className="h-4 w-4 mr-2" />
                  Dokument
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        {/* Global Search Placeholder */}
        <div className="relative hidden w-72 lg:block ml-4">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Sök lagar, föreskrifter..."
            className="h-9 pl-9 bg-muted/50 border-0 focus-visible:bg-background focus-visible:ring-1"
            disabled
            title="Sökning kommer snart"
          />
        </div>

        {/* Story 8.5: In-app notification bell */}
        <NotificationBell userId={user.id} />
      </header>

      {/* Story 6.7: Global Task Creation Modal */}
      <CreateTaskModal
        open={createTaskModalOpen}
        onOpenChange={setCreateTaskModalOpen}
        currentUserId={user.id}
        onTaskCreated={handleTaskCreated}
      />

      {/* Story 22.10: Global Laglista Creation Modal — templates threaded from
          workspace layout so the chooser experience matches /laglistor. */}
      <ManageListModal
        open={manageListModalOpen}
        onOpenChange={setManageListModalOpen}
        mode="create"
        templates={publishedTemplates}
        onCreated={handleListCreated}
        onUpdated={() => {}}
        onDeleted={() => {}}
      />

      {/* Story 22.10: Global Dokument Creation Dialog — self-routes after
          creation, no callback wiring required. */}
      <CreateDocumentDialog
        open={createDocumentDialogOpen}
        onOpenChange={setCreateDocumentDialogOpen}
      />
    </>
  )
}
