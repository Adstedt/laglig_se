/**
 * Story 5.7 & 6.5: Tests for SettingsTabs component
 */

import { render, screen } from '@testing-library/react'
import { vi, describe, beforeEach, it, expect } from 'vitest'

// SettingsTabs (Story 5.13+) uses useRouter + useSearchParams to control the
// active tab via the ?tab= URL param; tests render it outside an App Router
// context so we stub navigation.
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    replace: vi.fn(),
    push: vi.fn(),
    refresh: vi.fn(),
  }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/settings',
}))

import {
  SettingsTabs,
  type WorkspaceData,
  type BillingData,
  type MemberData,
} from '@/components/features/settings/settings-tabs'
import type {
  WorkspaceRole,
  WorkspaceStatus,
  SubscriptionTier,
} from '@prisma/client'
import type { TaskColumnWithCount } from '@/app/actions/tasks'

// Mock useWorkspace hook
vi.mock('@/hooks/use-workspace', () => ({
  useWorkspace: vi.fn(),
}))

// Story 7.5: the Kollektivavtal tab mounts KollektivavtalManager, whose module
// imports the collective-agreements server actions — mock at the boundary.
// Story 7.6 adds edit/delete/bulk-assign actions + the assign dialog's
// lazy group fetch.
vi.mock('@/app/actions/collective-agreements', () => ({
  uploadCollectiveAgreement: vi.fn(),
  listCollectiveAgreements: vi.fn().mockResolvedValue({
    success: true,
    data: [],
  }),
  updateCollectiveAgreement: vi.fn(),
  deleteCollectiveAgreement: vi.fn(),
  assignCollectiveAgreementBulk: vi.fn(),
  previewBulkAssignCount: vi.fn(),
}))

vi.mock('@/app/actions/employees', () => ({
  getEmployeeGroups: vi.fn().mockResolvedValue({ success: true, data: [] }),
}))

import { useWorkspace } from '@/hooks/use-workspace'

// Helper to create mock workspace context
const mockWorkspaceContext = (
  overrides: Partial<ReturnType<typeof useWorkspace>> = {}
): ReturnType<typeof useWorkspace> => ({
  workspaceId: 'ws_123',
  workspaceName: 'Test Workspace',
  workspaceSlug: 'test-workspace',
  workspaceStatus: 'ACTIVE' as WorkspaceStatus,
  role: 'OWNER' as WorkspaceRole,
  isLoading: false,
  error: null,
  refresh: async () => {},
  ...overrides,
})

// Mock workspace data
const mockWorkspace: WorkspaceData = {
  id: 'ws_123',
  name: 'Test Workspace',
  sni_code: '62.010',
  company_logo: null,
  subscription_tier: 'TRIAL' as SubscriptionTier,
  trial_ends_at: new Date('2025-01-15'),
  trial_picked_tier: null,
  enterprise_inquiry_at: null,
}

// Story 5.13: SettingsTabs requires billing data + tab state. Tests render
// non-billing tabs by default so the BillingDashboard tree never mounts.
const mockBilling: BillingData = {
  subscriptionStatus: null,
  stripeCustomerId: null,
  stripeSubscriptionId: null,
  currentPeriodEnd: null,
  paymentGracePeriodEndsAt: null,
}

function renderTabs(
  props: Partial<React.ComponentProps<typeof SettingsTabs>> = {}
) {
  return render(
    <SettingsTabs
      workspace={mockWorkspace}
      members={mockMembers}
      columns={mockColumns}
      companyProfile={null}
      collectiveAgreements={[]}
      billing={mockBilling}
      initialTab="general"
      showPastDueBanner={false}
      showCheckoutSuccess={false}
      {...props}
    />
  )
}

// Mock members data
const mockMembers: MemberData[] = [
  {
    id: 'mem_1',
    user: {
      id: 'user_1',
      name: 'Anna Owner',
      email: 'anna@example.com',
      avatar_url: null,
    },
    role: 'OWNER' as WorkspaceRole,
    joined_at: new Date('2024-12-01'),
  },
  {
    id: 'mem_2',
    user: {
      id: 'user_2',
      name: 'Bob Admin',
      email: 'bob@example.com',
      avatar_url: null,
    },
    role: 'ADMIN' as WorkspaceRole,
    joined_at: new Date('2024-12-05'),
  },
]

// Mock columns data (Story 6.5)
const mockColumns: TaskColumnWithCount[] = [
  {
    id: 'col_1',
    workspace_id: 'ws_123',
    name: 'Att göra',
    color: '#6b7280',
    position: 0,
    is_default: true,
    is_done: false,
    created_at: new Date(),
    updated_at: new Date(),
    _count: { tasks: 5 },
  },
  {
    id: 'col_2',
    workspace_id: 'ws_123',
    name: 'Pågående',
    color: '#3b82f6',
    position: 1,
    is_default: true,
    is_done: false,
    created_at: new Date(),
    updated_at: new Date(),
    _count: { tasks: 3 },
  },
  {
    id: 'col_3',
    workspace_id: 'ws_123',
    name: 'Klar',
    color: '#22c55e',
    position: 2,
    is_default: true,
    is_done: true,
    created_at: new Date(),
    updated_at: new Date(),
    _count: { tasks: 10 },
  },
]

describe('SettingsTabs', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('loading state', () => {
    beforeEach(() => {
      vi.mocked(useWorkspace).mockReturnValue(
        mockWorkspaceContext({ isLoading: true })
      )
    })

    it('shows loading skeleton while workspace context loads', () => {
      renderTabs()

      // Should show skeletons, not tabs
      expect(screen.queryByText('Allmänt')).not.toBeInTheDocument()
      expect(screen.queryByText('Team')).not.toBeInTheDocument()
      expect(screen.queryByText('Fakturering')).not.toBeInTheDocument()
    })
  })

  describe('with OWNER role', () => {
    beforeEach(() => {
      vi.mocked(useWorkspace).mockReturnValue(
        mockWorkspaceContext({ role: 'OWNER' as WorkspaceRole })
      )
    })

    it('renders all tabs for OWNER including Arbetsflöde', () => {
      renderTabs()

      expect(screen.getByText('Allmänt')).toBeInTheDocument()
      expect(screen.getByText('Team')).toBeInTheDocument()
      expect(screen.getByText('Fakturering')).toBeInTheDocument()
      expect(screen.getByText('Aviseringar')).toBeInTheDocument()
      expect(screen.getByText('Integrationer')).toBeInTheDocument()
      expect(screen.getByText('Arbetsflöde')).toBeInTheDocument()
    })

    it('shows General tab content by default', () => {
      renderTabs()

      expect(screen.getByText('Allmänna inställningar')).toBeInTheDocument()
    })
  })

  describe('with ADMIN role', () => {
    beforeEach(() => {
      vi.mocked(useWorkspace).mockReturnValue(
        mockWorkspaceContext({ role: 'ADMIN' as WorkspaceRole })
      )
    })

    it('hides Billing tab for non-OWNER', () => {
      renderTabs()

      expect(screen.getByText('Allmänt')).toBeInTheDocument()
      expect(screen.getByText('Team')).toBeInTheDocument()
      expect(screen.queryByText('Fakturering')).not.toBeInTheDocument()
      expect(screen.getByText('Aviseringar')).toBeInTheDocument()
      expect(screen.getByText('Integrationer')).toBeInTheDocument()
    })
  })

  describe('with MEMBER role', () => {
    beforeEach(() => {
      vi.mocked(useWorkspace).mockReturnValue(
        mockWorkspaceContext({ role: 'MEMBER' as WorkspaceRole })
      )
    })

    it('hides Billing tab for MEMBER', () => {
      renderTabs()

      expect(screen.queryByText('Fakturering')).not.toBeInTheDocument()
    })

    it('still shows other tabs for MEMBER', () => {
      renderTabs()

      expect(screen.getByText('Allmänt')).toBeInTheDocument()
      expect(screen.getByText('Team')).toBeInTheDocument()
      expect(screen.getByText('Aviseringar')).toBeInTheDocument()
      expect(screen.getByText('Integrationer')).toBeInTheDocument()
    })
  })

  describe('with AUDITOR role', () => {
    beforeEach(() => {
      vi.mocked(useWorkspace).mockReturnValue(
        mockWorkspaceContext({ role: 'AUDITOR' as WorkspaceRole })
      )
    })

    it('hides Billing tab for AUDITOR', () => {
      renderTabs()

      expect(screen.queryByText('Fakturering')).not.toBeInTheDocument()
    })
  })

  describe('with HR_MANAGER role', () => {
    beforeEach(() => {
      vi.mocked(useWorkspace).mockReturnValue(
        mockWorkspaceContext({ role: 'HR_MANAGER' as WorkspaceRole })
      )
    })

    it('hides Billing tab for HR_MANAGER', () => {
      renderTabs()

      expect(screen.queryByText('Fakturering')).not.toBeInTheDocument()
    })
  })

  describe('Kollektivavtal tab (Story 7.5 + 7.6 UX-ADMIN-001)', () => {
    it('shows the Kollektivavtal tab for OWNER (workspace:settings AND employees:view)', () => {
      vi.mocked(useWorkspace).mockReturnValue(
        mockWorkspaceContext({ role: 'OWNER' as WorkspaceRole })
      )
      renderTabs()
      expect(
        screen.getByRole('tab', { name: /kollektivavtal/i })
      ).toBeInTheDocument()
    })

    it('UX-ADMIN-001: hides the tab for ADMIN (workspace:settings but NO employees:view — the tab was permanently broken)', () => {
      vi.mocked(useWorkspace).mockReturnValue(
        mockWorkspaceContext({ role: 'ADMIN' as WorkspaceRole })
      )
      renderTabs()
      expect(screen.queryByRole('tab', { name: /kollektivavtal/i })).toBeNull()
    })

    it('UX-ADMIN-001: ADMIN gets no tab content either, even with the tab param forced', () => {
      vi.mocked(useWorkspace).mockReturnValue(
        mockWorkspaceContext({ role: 'ADMIN' as WorkspaceRole })
      )
      renderTabs({ initialTab: 'kollektivavtal' })
      expect(
        screen.queryByText('Inga kollektivavtal har laddats upp än.')
      ).toBeNull()
      expect(screen.queryByText('Kollektivavtal kunde inte laddas.')).toBeNull()
    })

    it('hides the tab for HR_MANAGER (no workspace:settings — HR mount is their entry point) and MEMBER', () => {
      vi.mocked(useWorkspace).mockReturnValue(
        mockWorkspaceContext({ role: 'HR_MANAGER' as WorkspaceRole })
      )
      const { unmount } = renderTabs()
      expect(screen.queryByRole('tab', { name: /kollektivavtal/i })).toBeNull()
      unmount()

      vi.mocked(useWorkspace).mockReturnValue(
        mockWorkspaceContext({ role: 'MEMBER' as WorkspaceRole })
      )
      renderTabs()
      expect(screen.queryByRole('tab', { name: /kollektivavtal/i })).toBeNull()
    })

    it('mounts the shared KollektivavtalManager in the tab content (OWNER: list + upload form)', () => {
      vi.mocked(useWorkspace).mockReturnValue(
        mockWorkspaceContext({ role: 'OWNER' as WorkspaceRole })
      )
      renderTabs({ initialTab: 'kollektivavtal' })

      expect(
        screen.getByText('Inga kollektivavtal har laddats upp än.')
      ).toBeInTheDocument()
      // OWNER holds employees:manage → the shared upload form renders.
      expect(screen.getByLabelText(/PDF-fil/)).toBeInTheDocument()
    })
  })

  describe('Arbetsflöde tab (Story 6.5)', () => {
    beforeEach(() => {
      vi.mocked(useWorkspace).mockReturnValue(
        mockWorkspaceContext({ role: 'MEMBER' as WorkspaceRole })
      )
    })

    it('shows Arbetsflöde tab for all roles', () => {
      renderTabs()

      expect(screen.getByText('Arbetsflöde')).toBeInTheDocument()
    })

    it('renders Arbetsflöde tab with Columns icon', () => {
      renderTabs()

      // Find the tab button with Arbetsflöde text
      const tab = screen.getByRole('tab', { name: /arbetsflöde/i })
      expect(tab).toBeInTheDocument()
    })
  })
})
