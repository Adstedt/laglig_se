import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ChangeType, NotificationType } from '@prisma/client'

const CHANGE_EVENT_ID = 'ce-123'
const DOCUMENT_ID = 'doc-456'

const mockChangeEvent = {
  id: CHANGE_EVENT_ID,
  document_id: DOCUMENT_ID,
  content_type: 'SFS_LAW',
  change_type: 'AMENDMENT',
  amendment_sfs: 'SFS 2026:145',
  ai_summary:
    'Denna ändring innebär att arbetsgivare nu måste genomföra riskbedömningar kvartalsvis istället för årligen. Kravet gäller alla arbetsplatser med fler än tio anställda.',
  notification_sent: false,
  detected_at: new Date(),
  document: {
    id: DOCUMENT_ID,
    title: 'Arbetsmiljölagen (1977:1160)',
  },
}

const mockRecipients = [
  {
    userId: 'user-1',
    email: 'alice@test.com',
    name: 'Alice',
    workspaceId: 'ws-1',
    workspaceName: 'Workspace A',
  },
  {
    userId: 'user-2',
    email: 'bob@test.com',
    name: 'Bob',
    workspaceId: 'ws-1',
    workspaceName: 'Workspace A',
  },
  {
    userId: 'user-3',
    email: 'carol@test.com',
    name: 'Carol',
    workspaceId: 'ws-2',
    workspaceName: 'Workspace B',
  },
]

vi.mock('@/lib/prisma', () => ({
  prisma: {
    changeEvent: {
      findUnique: vi.fn(),
    },
    notificationPreference: {
      findUnique: vi.fn(),
    },
    notification: {
      findFirst: vi.fn(),
      create: vi.fn(),
    },
  },
}))

vi.mock('@/lib/notifications/recipient-resolution', () => ({
  resolveAffectedRecipients: vi.fn(),
}))

import { prisma } from '@/lib/prisma'
import { resolveAffectedRecipients } from '@/lib/notifications/recipient-resolution'
import {
  createChangeNotifications,
  processChangeEventNotifications,
  changeTypeToNotificationType,
  notificationBodyForChangeType,
} from '@/lib/notifications/amendment-notifications'

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(prisma.changeEvent.findUnique).mockResolvedValue(
    mockChangeEvent as never
  )
  vi.mocked(resolveAffectedRecipients).mockResolvedValue(mockRecipients)
  vi.mocked(prisma.notificationPreference.findUnique).mockResolvedValue(null)
  vi.mocked(prisma.notification.findFirst).mockResolvedValue(null)
  vi.mocked(prisma.notification.create).mockResolvedValue({} as never)
})

// ============================================================================
// Helper function tests
// ============================================================================

describe('changeTypeToNotificationType', () => {
  it('maps AMENDMENT to AMENDMENT_DETECTED', () => {
    expect(changeTypeToNotificationType(ChangeType.AMENDMENT)).toBe(
      NotificationType.AMENDMENT_DETECTED
    )
  })

  it('maps REPEAL to LAW_REPEALED', () => {
    expect(changeTypeToNotificationType(ChangeType.REPEAL)).toBe(
      NotificationType.LAW_REPEALED
    )
  })

  it('maps NEW_RULING to RULING_CITED', () => {
    expect(changeTypeToNotificationType(ChangeType.NEW_RULING)).toBe(
      NotificationType.RULING_CITED
    )
  })

  it('returns null for NEW_LAW', () => {
    expect(changeTypeToNotificationType(ChangeType.NEW_LAW)).toBeNull()
  })

  it('returns null for METADATA_UPDATE', () => {
    expect(changeTypeToNotificationType(ChangeType.METADATA_UPDATE)).toBeNull()
  })
})

describe('notificationBodyForChangeType', () => {
  it('builds AMENDMENT body with ref and summary', () => {
    expect(
      notificationBodyForChangeType(
        ChangeType.AMENDMENT,
        'SFS 2026:145',
        'Krav på kvartalsvis riskbedömning'
      )
    ).toBe('Ändrad genom SFS 2026:145. Krav på kvartalsvis riskbedömning')
  })

  it('builds AMENDMENT body with ref only when no summary', () => {
    expect(
      notificationBodyForChangeType(ChangeType.AMENDMENT, 'SFS 2026:145', null)
    ).toBe('Ändrad genom SFS 2026:145')
  })

  it('builds REPEAL body with ref and summary', () => {
    expect(
      notificationBodyForChangeType(
        ChangeType.REPEAL,
        'SFS 2026:200',
        'Lagen ersätts'
      )
    ).toBe('Upphävd genom SFS 2026:200. Lagen ersätts')
  })

  it('builds REPEAL body with ref only when no summary', () => {
    expect(
      notificationBodyForChangeType(ChangeType.REPEAL, 'SFS 2026:200', null)
    ).toBe('Upphävd genom SFS 2026:200')
  })

  it('builds NEW_RULING body with summary', () => {
    expect(
      notificationBodyForChangeType(
        ChangeType.NEW_RULING,
        null,
        'Avgörande om arbetsgivaransvar'
      )
    ).toBe('Avgörande om arbetsgivaransvar')
  })

  it('builds NEW_RULING body with fallback when no summary', () => {
    expect(
      notificationBodyForChangeType(ChangeType.NEW_RULING, null, null)
    ).toBe('Nytt avgörande')
  })

  it('uses "okänd" for null ref in AMENDMENT', () => {
    expect(
      notificationBodyForChangeType(ChangeType.AMENDMENT, null, null)
    ).toBe('Ändrad genom okänd')
  })

  it('truncates ai_summary to 150 characters', () => {
    const longSummary = 'A'.repeat(200)
    const body = notificationBodyForChangeType(
      ChangeType.AMENDMENT,
      'SFS 2026:1',
      longSummary
    )
    expect(body).toBe(`Ändrad genom SFS 2026:1. ${'A'.repeat(150)}`)
  })
})

// ============================================================================
// createChangeNotifications tests
// ============================================================================

describe('createChangeNotifications', () => {
  it('creates correct Notification records per recipient', async () => {
    const stats = await createChangeNotifications(CHANGE_EVENT_ID)

    expect(stats.notificationsCreated).toBe(3)
    expect(stats.usersNotified).toBe(3)
    expect(stats.workspacesAffected).toBe(2)
    expect(stats.skippedByPreference).toBe(0)

    expect(prisma.notification.create).toHaveBeenCalledTimes(3)
    expect(prisma.notification.create).toHaveBeenCalledWith({
      data: {
        user_id: 'user-1',
        workspace_id: 'ws-1',
        type: NotificationType.AMENDMENT_DETECTED,
        title: 'Arbetsmiljölagen (1977:1160)',
        body: expect.stringContaining('Ändrad genom SFS 2026:145'),
        entity_type: 'change_event',
        entity_id: CHANGE_EVENT_ID,
      },
    })
  })

  it('skips user with amendment_detected_enabled = false', async () => {
    vi.mocked(prisma.notificationPreference.findUnique)
      .mockResolvedValueOnce({
        amendment_detected_enabled: false,
      } as never)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)

    const stats = await createChangeNotifications(CHANGE_EVENT_ID)

    expect(stats.notificationsCreated).toBe(2)
    expect(stats.skippedByPreference).toBe(1)
    expect(prisma.notification.create).toHaveBeenCalledTimes(2)
  })

  it('creates notification when no preference record exists (defaults)', async () => {
    vi.mocked(prisma.notificationPreference.findUnique).mockResolvedValue(null)

    const stats = await createChangeNotifications(CHANGE_EVENT_ID)

    expect(stats.notificationsCreated).toBe(3)
  })

  it('is idempotent — does not create duplicates', async () => {
    vi.mocked(prisma.notification.findFirst)
      .mockResolvedValueOnce({ id: 'existing' } as never)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)

    const stats = await createChangeNotifications(CHANGE_EVENT_ID)

    expect(stats.notificationsCreated).toBe(2)
    expect(prisma.notification.create).toHaveBeenCalledTimes(2)
  })

  it('uses document title as notification title', async () => {
    await createChangeNotifications(CHANGE_EVENT_ID)

    const createCalls = vi.mocked(prisma.notification.create).mock.calls
    for (const call of createCalls) {
      expect(call[0].data.title).toBe('Arbetsmiljölagen (1977:1160)')
    }
  })

  it('includes amendment_sfs and ai_summary snippet in body', async () => {
    await createChangeNotifications(CHANGE_EVENT_ID)

    const createCalls = vi.mocked(prisma.notification.create).mock.calls
    const body = createCalls[0]![0].data.body as string
    expect(body).toContain('SFS 2026:145')
    expect(body).toContain('Denna ändring innebär')
    expect(body.length).toBeLessThanOrEqual(
      'Ändrad genom SFS 2026:145. '.length + 150
    )
  })

  it('uses fallback body when ai_summary is null', async () => {
    vi.mocked(prisma.changeEvent.findUnique).mockResolvedValue({
      ...mockChangeEvent,
      ai_summary: null,
    } as never)

    await createChangeNotifications(CHANGE_EVENT_ID)

    const createCalls = vi.mocked(prisma.notification.create).mock.calls
    expect(createCalls[0]![0].data.body).toBe('Ändrad genom SFS 2026:145')
  })

  it('uses fallback text when amendment_sfs is null', async () => {
    vi.mocked(prisma.changeEvent.findUnique).mockResolvedValue({
      ...mockChangeEvent,
      amendment_sfs: null,
      ai_summary: null,
    } as never)

    await createChangeNotifications(CHANGE_EVENT_ID)

    const createCalls = vi.mocked(prisma.notification.create).mock.calls
    expect(createCalls[0]![0].data.body).toBe('Ändrad genom okänd')
  })

  it('returns correct stats object', async () => {
    const stats = await createChangeNotifications(CHANGE_EVENT_ID)

    expect(stats).toEqual({
      notificationsCreated: 3,
      usersNotified: 3,
      workspacesAffected: 2,
      skippedByPreference: 0,
    })
  })

  it('returns zero stats when ChangeEvent not found', async () => {
    vi.mocked(prisma.changeEvent.findUnique).mockResolvedValue(null)

    const stats = await createChangeNotifications('nonexistent')

    expect(stats).toEqual({
      notificationsCreated: 0,
      usersNotified: 0,
      workspacesAffected: 0,
      skippedByPreference: 0,
    })
    expect(prisma.notification.create).not.toHaveBeenCalled()
  })

  it('returns zero stats when no recipients found', async () => {
    vi.mocked(resolveAffectedRecipients).mockResolvedValue([])

    const stats = await createChangeNotifications(CHANGE_EVENT_ID)

    expect(stats).toEqual({
      notificationsCreated: 0,
      usersNotified: 0,
      workspacesAffected: 0,
      skippedByPreference: 0,
    })
  })

  // ---- New change-type specific tests ----

  it('REPEAL ChangeEvent creates LAW_REPEALED notification', async () => {
    vi.mocked(prisma.changeEvent.findUnique).mockResolvedValue({
      ...mockChangeEvent,
      change_type: 'REPEAL',
      amendment_sfs: 'SFS 2026:200',
      ai_summary: 'Lagen har upphävts',
    } as never)

    const stats = await createChangeNotifications(CHANGE_EVENT_ID)

    expect(stats.notificationsCreated).toBe(3)
    expect(prisma.notification.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          type: NotificationType.LAW_REPEALED,
          body: 'Upphävd genom SFS 2026:200. Lagen har upphävts',
        }),
      })
    )
  })

  it('NEW_RULING ChangeEvent creates RULING_CITED notification', async () => {
    vi.mocked(prisma.changeEvent.findUnique).mockResolvedValue({
      ...mockChangeEvent,
      change_type: 'NEW_RULING',
      amendment_sfs: null,
      ai_summary: 'Avgörande om arbetsgivaransvar',
    } as never)

    const stats = await createChangeNotifications(CHANGE_EVENT_ID)

    expect(stats.notificationsCreated).toBe(3)
    expect(prisma.notification.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          type: NotificationType.RULING_CITED,
          body: 'Avgörande om arbetsgivaransvar',
        }),
      })
    )
  })

  it('NEW_LAW ChangeEvent creates NO notifications', async () => {
    vi.mocked(prisma.changeEvent.findUnique).mockResolvedValue({
      ...mockChangeEvent,
      change_type: 'NEW_LAW',
      amendment_sfs: null,
      ai_summary: null,
    } as never)

    const stats = await createChangeNotifications(CHANGE_EVENT_ID)

    expect(stats.notificationsCreated).toBe(0)
    expect(prisma.notification.create).not.toHaveBeenCalled()
  })

  it('METADATA_UPDATE ChangeEvent creates NO notifications', async () => {
    vi.mocked(prisma.changeEvent.findUnique).mockResolvedValue({
      ...mockChangeEvent,
      change_type: 'METADATA_UPDATE',
      amendment_sfs: null,
      ai_summary: null,
    } as never)

    const stats = await createChangeNotifications(CHANGE_EVENT_ID)

    expect(stats.notificationsCreated).toBe(0)
    expect(prisma.notification.create).not.toHaveBeenCalled()
  })

  it('REPEAL checks law_repealed_enabled preference', async () => {
    vi.mocked(prisma.changeEvent.findUnique).mockResolvedValue({
      ...mockChangeEvent,
      change_type: 'REPEAL',
      amendment_sfs: 'SFS 2026:200',
      ai_summary: null,
    } as never)

    vi.mocked(prisma.notificationPreference.findUnique)
      .mockResolvedValueOnce({ law_repealed_enabled: false } as never)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)

    const stats = await createChangeNotifications(CHANGE_EVENT_ID)

    expect(stats.skippedByPreference).toBe(1)
    expect(stats.notificationsCreated).toBe(2)
  })

  it('NEW_RULING checks ruling_cited_enabled preference', async () => {
    vi.mocked(prisma.changeEvent.findUnique).mockResolvedValue({
      ...mockChangeEvent,
      change_type: 'NEW_RULING',
      amendment_sfs: null,
      ai_summary: null,
    } as never)

    vi.mocked(prisma.notificationPreference.findUnique)
      .mockResolvedValueOnce({ ruling_cited_enabled: false } as never)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)

    const stats = await createChangeNotifications(CHANGE_EVENT_ID)

    expect(stats.skippedByPreference).toBe(1)
    expect(stats.notificationsCreated).toBe(2)
  })
})

describe('processChangeEventNotifications', () => {
  it('processes multiple ChangeEvents and aggregates stats', async () => {
    const stats = await processChangeEventNotifications(['ce-1', 'ce-2'])

    expect(prisma.changeEvent.findUnique).toHaveBeenCalledTimes(2)
    expect(stats.notificationsCreated).toBe(6) // 3 per event × 2 events
  })

  it('continues processing when one ChangeEvent fails', async () => {
    vi.mocked(prisma.changeEvent.findUnique)
      .mockRejectedValueOnce(new Error('DB timeout'))
      .mockResolvedValueOnce(mockChangeEvent as never)

    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

    const stats = await processChangeEventNotifications(['ce-fail', 'ce-ok'])

    expect(stats.notificationsCreated).toBe(3) // only the successful one
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('Failed to process ChangeEvent notifications')
    )
    consoleSpy.mockRestore()
  })

  it('logs error with context for failed ChangeEvent', async () => {
    vi.mocked(prisma.changeEvent.findUnique).mockRejectedValueOnce(
      new Error('Connection lost')
    )

    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

    await processChangeEventNotifications(['ce-fail'])

    const logCall = consoleSpy.mock.calls[0]![0] as string
    const parsed = JSON.parse(logCall)
    expect(parsed.level).toBe('error')
    expect(parsed.changeEventId).toBe('ce-fail')
    expect(parsed.error).toBe('Connection lost')
    consoleSpy.mockRestore()
  })
})
