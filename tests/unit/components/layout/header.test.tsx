/**
 * Story 22.10: Tests for the unified "+ Skapa" creation menu in Header.
 */

import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi, describe, beforeEach, it, expect, type Mock } from 'vitest'
import type { WorkspaceRole } from '@prisma/client'
import type { PublishedTemplate } from '@/lib/db/queries/template-catalog'
import { Header } from '@/components/layout/header'

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const pushMock = vi.fn()
const refreshMock = vi.fn()

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: pushMock,
    refresh: refreshMock,
  }),
  usePathname: () => '/dashboard',
  useSearchParams: () => new URLSearchParams(),
}))

// Capture the latest shortcut callback so the keyboard test can fire it directly
let capturedShortcutCallback: (() => void) | null = null
vi.mock('@/lib/hooks/use-global-keyboard-shortcuts', () => ({
  useGlobalKeyboardShortcuts: ({
    onQuickTaskCreate,
  }: {
    onQuickTaskCreate: () => void
  }) => {
    capturedShortcutCallback = onQuickTaskCreate
  },
}))

// Capture dialog props so we can assert open === true after a click. The
// CreateTaskModal mock also exposes a button that fires the `onTaskCreated`
// callback so we can verify the page-refresh wiring (AC 17).
const createTaskModalMock = vi.fn()
vi.mock('@/components/features/tasks/create-task-modal', () => ({
  CreateTaskModal: (props: {
    open: boolean
    onTaskCreated?: (_task: unknown) => void
  }) => {
    createTaskModalMock(props)
    if (!props.open) return null
    return (
      <div data-testid="create-task-modal" data-open="true">
        <button
          data-testid="trigger-task-created"
          onClick={() => props.onTaskCreated?.({ id: 'task-1', title: 'Test' })}
        >
          fire onTaskCreated
        </button>
      </div>
    )
  },
}))

const manageListModalMock = vi.fn()
vi.mock('@/components/features/document-list/manage-list-modal', () => ({
  ManageListModal: (props: {
    open: boolean
    templates?: PublishedTemplate[]
  }) => {
    manageListModalMock(props)
    return props.open ? (
      <div
        data-testid="manage-list-modal"
        data-open="true"
        data-template-count={props.templates?.length ?? 0}
      />
    ) : null
  },
}))

const createDocumentDialogMock = vi.fn()
vi.mock('@/components/features/documents/create-document-dialog', () => ({
  CreateDocumentDialog: (props: { open: boolean }) => {
    createDocumentDialogMock(props)
    return props.open ? (
      <div data-testid="create-document-dialog" data-open="true" />
    ) : null
  },
}))

vi.mock('@/components/features/notifications/notification-bell', () => ({
  NotificationBell: () => <div data-testid="notification-bell" />,
}))

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const mockUser = {
  id: 'user-1',
  name: 'Alex',
  email: 'alex@example.com',
  image: null,
}

const mockTemplates: PublishedTemplate[] = [
  {
    id: 'tpl-1',
    name: 'Arbetsmiljö',
    slug: 'arbetsmiljo',
    description: null,
    domain: 'arbetsmiljo',
    target_audience: null,
    document_count: 10,
    section_count: 3,
    primary_regulatory_bodies: [],
    is_variant: false,
    variants: [],
  },
]

function renderHeader(
  role: WorkspaceRole,
  templates: PublishedTemplate[] = mockTemplates
) {
  return render(
    <Header user={mockUser} role={role} publishedTemplates={templates} />
  )
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Header — unified "+ Skapa" menu (Story 22.10)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    capturedShortcutCallback = null
  })

  describe('Trigger button visibility (AC 6, 7)', () => {
    it('renders the "+ Skapa" trigger for OWNER', () => {
      renderHeader('OWNER')
      expect(screen.getByRole('button', { name: /skapa/i })).toBeInTheDocument()
    })

    it('renders the "+ Skapa" trigger for HR_MANAGER', () => {
      renderHeader('HR_MANAGER')
      expect(screen.getByRole('button', { name: /skapa/i })).toBeInTheDocument()
    })

    it('renders the "+ Skapa" trigger for MEMBER', () => {
      renderHeader('MEMBER')
      expect(screen.getByRole('button', { name: /skapa/i })).toBeInTheDocument()
    })

    it('hides the "+ Skapa" trigger entirely for AUDITOR (no create perms)', () => {
      renderHeader('AUDITOR')
      expect(
        screen.queryByRole('button', { name: /skapa/i })
      ).not.toBeInTheDocument()
    })
  })

  describe('Menu contents per role (AC 1, 2, 6)', () => {
    it('OWNER sees all four items (Uppgift, Kontroll, Laglista, Dokument)', async () => {
      const user = userEvent.setup()
      renderHeader('OWNER')

      await user.click(screen.getByRole('button', { name: /skapa/i }))

      const items = screen.getAllByRole('menuitem')
      expect(items).toHaveLength(4)
      expect(items[0]).toHaveTextContent('Uppgift')
      expect(items[1]).toHaveTextContent('Kontroll')
      expect(items[2]).toHaveTextContent('Laglista')
      expect(items[3]).toHaveTextContent('Dokument')
    })

    it('HR_MANAGER sees all four items (full create permissions)', async () => {
      const user = userEvent.setup()
      renderHeader('HR_MANAGER')

      await user.click(screen.getByRole('button', { name: /skapa/i }))

      const items = screen.getAllByRole('menuitem')
      expect(items).toHaveLength(4)
    })

    it('MEMBER sees only Uppgift and Kontroll (tasks:edit only)', async () => {
      const user = userEvent.setup()
      renderHeader('MEMBER')

      await user.click(screen.getByRole('button', { name: /skapa/i }))

      const items = screen.getAllByRole('menuitem')
      expect(items).toHaveLength(2)
      expect(items[0]).toHaveTextContent('Uppgift')
      expect(items[1]).toHaveTextContent('Kontroll')
      expect(
        screen.queryByRole('menuitem', { name: /laglista/i })
      ).not.toBeInTheDocument()
      expect(
        screen.queryByRole('menuitem', { name: /dokument/i })
      ).not.toBeInTheDocument()
    })
  })

  describe('Trigger ARIA (AC 10)', () => {
    it('exposes aria-haspopup="menu" on the trigger', () => {
      renderHeader('OWNER')
      const trigger = screen.getByRole('button', { name: /skapa/i })
      expect(trigger).toHaveAttribute('aria-haspopup', 'menu')
    })
  })

  describe('Item click handlers (AC 3)', () => {
    it('clicking "Uppgift" opens CreateTaskModal', async () => {
      const user = userEvent.setup()
      renderHeader('OWNER')

      await user.click(screen.getByRole('button', { name: /skapa/i }))
      await user.click(screen.getByRole('menuitem', { name: /uppgift/i }))

      expect(screen.getByTestId('create-task-modal')).toHaveAttribute(
        'data-open',
        'true'
      )
    })

    it('clicking "Kontroll" navigates to /laglistor/kontroller/skapa', async () => {
      const user = userEvent.setup()
      renderHeader('OWNER')

      await user.click(screen.getByRole('button', { name: /skapa/i }))
      await user.click(screen.getByRole('menuitem', { name: /kontroll/i }))

      expect(pushMock).toHaveBeenCalledWith('/laglistor/kontroller/skapa')
    })

    it('clicking "Laglista" opens ManageListModal with threaded templates', async () => {
      const user = userEvent.setup()
      renderHeader('OWNER')

      await user.click(screen.getByRole('button', { name: /skapa/i }))
      await user.click(screen.getByRole('menuitem', { name: /laglista/i }))

      const modal = screen.getByTestId('manage-list-modal')
      expect(modal).toHaveAttribute('data-open', 'true')
      expect(modal).toHaveAttribute('data-template-count', '1')
    })

    it('clicking "Dokument" opens CreateDocumentDialog', async () => {
      const user = userEvent.setup()
      renderHeader('OWNER')

      await user.click(screen.getByRole('button', { name: /skapa/i }))
      await user.click(screen.getByRole('menuitem', { name: /dokument/i }))

      expect(screen.getByTestId('create-document-dialog')).toHaveAttribute(
        'data-open',
        'true'
      )
    })
  })

  describe('Keyboard shortcut preservation (AC 5)', () => {
    it('Ctrl+Shift+T fires onQuickTaskCreate which opens CreateTaskModal directly', () => {
      renderHeader('OWNER')

      // Sanity: dropdown is closed (no menu items in DOM)
      expect(screen.queryByRole('menuitem')).not.toBeInTheDocument()

      // Fire the captured shortcut callback (simulating Ctrl+Shift+T).
      // Wrap in act() so React flushes the resulting state update before we
      // assert on the rendered output.
      expect(capturedShortcutCallback).not.toBeNull()
      act(() => {
        ;(capturedShortcutCallback as () => void)()
      })

      // Task modal opens; menu does NOT appear
      expect(screen.getByTestId('create-task-modal')).toHaveAttribute(
        'data-open',
        'true'
      )
      expect(screen.queryByRole('menuitem')).not.toBeInTheDocument()
    })
  })

  describe('Esc returns focus to trigger (AC 9)', () => {
    it('pressing Esc closes the menu and returns focus to the trigger', async () => {
      const user = userEvent.setup()
      renderHeader('OWNER')

      const trigger = screen.getByRole('button', { name: /skapa/i })
      await user.click(trigger)

      // Menu items rendered
      expect(screen.getAllByRole('menuitem')).toHaveLength(4)

      await user.keyboard('{Escape}')

      // Menu closed
      expect(screen.queryByRole('menuitem')).not.toBeInTheDocument()
      // Focus returned to trigger (Radix default)
      expect(trigger).toHaveFocus()
    })
  })

  describe('onTaskCreated → router.refresh preservation (AC 17)', () => {
    it('calls router.refresh() after a task is created from the header modal', async () => {
      const user = userEvent.setup()
      renderHeader('OWNER')

      // Open the task modal via the menu
      await user.click(screen.getByRole('button', { name: /skapa/i }))
      await user.click(screen.getByRole('menuitem', { name: /uppgift/i }))

      // Fire the onTaskCreated callback from inside the mocked modal
      await user.click(screen.getByTestId('trigger-task-created'))

      expect(refreshMock).toHaveBeenCalledTimes(1)
    })
  })

  describe('Templates threading (AC 15)', () => {
    it('passes empty templates array straight through to ManageListModal', async () => {
      const user = userEvent.setup()
      renderHeader('OWNER', [])

      await user.click(screen.getByRole('button', { name: /skapa/i }))
      await user.click(screen.getByRole('menuitem', { name: /laglista/i }))

      const modal = screen.getByTestId('manage-list-modal')
      expect(modal).toHaveAttribute('data-template-count', '0')
    })

    it('mounts ManageListModal with the templates array (verified via mock spy)', () => {
      renderHeader('OWNER')

      const lastCall = (manageListModalMock as Mock).mock.calls.at(-1)?.[0] as {
        templates: PublishedTemplate[]
      }
      expect(lastCall.templates).toEqual(mockTemplates)
    })
  })
})
