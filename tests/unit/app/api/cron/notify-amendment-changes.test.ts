import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ChangeType, NotificationType } from '@prisma/client'

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

const CHANGE_EVENT_1 = {
  id: 'ce-1',
  document_id: 'doc-1',
  content_type: 'SFS_LAW',
  change_type: ChangeType.AMENDMENT,
  amendment_sfs: 'SFS 2026:145',
  diff_summary: null,
  ai_summary: 'En ändring i arbetsmiljölagen.',
  detected_at: new Date('2026-02-17T04:30:00Z'),
  notification_sent: false,
  document: {
    id: 'doc-1',
    title: 'Arbetsmiljölagen (1977:1160)',
    slug: 'sfs-1977-1160',
    document_number: 'SFS 1977:1160',
  },
}

const CHANGE_EVENT_2 = {
  id: 'ce-2',
  document_id: 'doc-2',
  content_type: 'SFS_LAW',
  change_type: ChangeType.REPEAL,
  amendment_sfs: 'SFS 2026:200',
  diff_summary: null,
  ai_summary: null,
  detected_at: new Date('2026-02-17T04:30:00Z'),
  notification_sent: false,
  document: {
    id: 'doc-2',
    title: 'Lag (2010:1011) om brandfarliga varor',
    slug: 'sfs-2010-1011',
    document_number: 'SFS 2010:1011',
  },
}

const RECIPIENTS_DOC1 = [
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
]

const AMENDMENT_DOC = {
  effective_date: new Date('2026-07-01'),
  original_url: 'https://riksdagen.se/sv/dokument/sfs-2026-145.pdf',
  section_changes: [
    { chapter: '7', section: '15', change_type: 'AMENDED' },
    { chapter: null, section: '2a', change_type: 'NEW' },
  ],
}

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockPrisma = {
  changeEvent: {
    findMany: vi.fn(),
    updateMany: vi.fn(),
  },
  amendmentDocument: {
    findUnique: vi.fn(),
  },
}

vi.mock('@/lib/prisma', () => ({
  prisma: mockPrisma,
}))

const mockResolveAffectedRecipients = vi.fn()
vi.mock('@/lib/notifications/recipient-resolution', () => ({
  resolveAffectedRecipients: (...args: unknown[]) =>
    mockResolveAffectedRecipients(...args),
}))

const mockProcessChangeEventNotifications = vi.fn().mockResolvedValue({
  notificationsCreated: 0,
  usersNotified: 0,
  workspacesAffected: 0,
  skippedByPreference: 0,
})
const mockChangeTypeToNotificationType = vi.fn((ct: ChangeType) => {
  if (ct === ChangeType.AMENDMENT) return NotificationType.AMENDMENT_DETECTED
  if (ct === ChangeType.REPEAL) return NotificationType.LAW_REPEALED
  if (ct === ChangeType.NEW_RULING) return NotificationType.RULING_CITED
  return null
})

vi.mock('@/lib/notifications', () => ({
  processChangeEventNotifications: (...args: unknown[]) =>
    mockProcessChangeEventNotifications(...args),
  changeTypeToNotificationType: (...args: unknown[]) =>
    mockChangeTypeToNotificationType(...args),
}))

const mockShouldSendEmail = vi.fn().mockResolvedValue(true)
vi.mock('@/lib/email/notification-preferences', () => ({
  shouldSendEmail: (...args: unknown[]) => mockShouldSendEmail(...args),
}))

const mockSendEmail = vi.fn().mockResolvedValue({ success: true })
const mockSendHtmlEmail = vi.fn().mockResolvedValue({ success: true })
vi.mock('@/lib/email/email-service', () => ({
  sendEmail: (...args: unknown[]) => mockSendEmail(...args),
  sendHtmlEmail: (...args: unknown[]) => mockSendHtmlEmail(...args),
  FROM_ADDRESSES: {
    notifications: 'Laglig.se <notifieringar@laglig.se>',
    'no-reply': 'Laglig.se <no-reply@laglig.se>',
    updates: 'Laglig.se <uppdateringar@laglig.se>',
    cron: 'Laglig.se <cron@laglig.se>',
  },
}))

vi.mock('@/lib/email/unsubscribe-token', () => ({
  generateUnsubscribeUrl: vi.fn(
    (userId: string, wsId: string) =>
      `https://laglig.se/unsubscribe?token=mock-${userId}-${wsId}`
  ),
}))

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

function makeRequest(authHeader?: string): Request {
  const headers = new Headers()
  if (authHeader) headers.set('authorization', authHeader)
  return new Request(
    'http://localhost:3000/api/cron/notify-amendment-changes',
    {
      headers,
    }
  )
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('notify-amendment-changes cron', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv('CRON_SECRET', 'test-secret')
    vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://laglig.se')
    mockPrisma.changeEvent.updateMany.mockResolvedValue({ count: 1 })
  })

  it('returns 401 when CRON_SECRET header is missing', async () => {
    const { GET } = await import(
      '@/app/api/cron/notify-amendment-changes/route'
    )
    const res = await GET(makeRequest())
    expect(res.status).toBe(401)
  })

  it('returns 401 when CRON_SECRET header is incorrect', async () => {
    const { GET } = await import(
      '@/app/api/cron/notify-amendment-changes/route'
    )
    const res = await GET(makeRequest('Bearer wrong-secret'))
    expect(res.status).toBe(401)
  })

  it('returns stats with zeros when no un-notified change events exist', async () => {
    const { GET } = await import(
      '@/app/api/cron/notify-amendment-changes/route'
    )
    mockPrisma.changeEvent.findMany.mockResolvedValue([])

    const res = await GET(makeRequest('Bearer test-secret'))
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.success).toBe(true)
    expect(data.stats.emailsSent).toBe(0)
    expect(data.stats.amendmentsProcessed).toBe(0)

    // Should send admin summary even with no work
    expect(mockSendHtmlEmail).toHaveBeenCalledOnce()
    // Should NOT send any user emails
    expect(mockSendEmail).not.toHaveBeenCalled()
  })

  it('sends 2 emails for 1 amendment + 1 workspace + 2 users', async () => {
    const { GET } = await import(
      '@/app/api/cron/notify-amendment-changes/route'
    )
    mockPrisma.changeEvent.findMany.mockResolvedValue([CHANGE_EVENT_1])
    mockPrisma.amendmentDocument.findUnique.mockResolvedValue(AMENDMENT_DOC)
    mockResolveAffectedRecipients.mockResolvedValue(RECIPIENTS_DOC1)

    const res = await GET(makeRequest('Bearer test-secret'))
    const data = await res.json()

    expect(data.success).toBe(true)
    expect(data.stats.emailsSent).toBe(2)
    expect(data.stats.amendmentsProcessed).toBe(1)

    // Verify sendEmail was called for each user
    expect(mockSendEmail).toHaveBeenCalledTimes(2)
    expect(mockSendEmail.mock.calls[0]![0]).toMatchObject({
      to: 'alice@test.com',
      from: 'updates',
    })
    expect(mockSendEmail.mock.calls[1]![0]).toMatchObject({
      to: 'bob@test.com',
      from: 'updates',
    })

    // Verify notification_sent marked true
    expect(mockPrisma.changeEvent.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ['ce-1'] } },
      data: { notification_sent: true },
    })
  })

  it('sends 1 digest with 2 change cards for 2 events in same workspace', async () => {
    const { GET } = await import(
      '@/app/api/cron/notify-amendment-changes/route'
    )
    const recipients = [
      {
        userId: 'user-1',
        email: 'alice@test.com',
        name: 'Alice',
        workspaceId: 'ws-1',
        workspaceName: 'Workspace A',
      },
    ]

    mockPrisma.changeEvent.findMany.mockResolvedValue([
      CHANGE_EVENT_1,
      CHANGE_EVENT_2,
    ])
    mockPrisma.amendmentDocument.findUnique.mockResolvedValue(AMENDMENT_DOC)
    mockResolveAffectedRecipients.mockResolvedValue(recipients)

    const res = await GET(makeRequest('Bearer test-secret'))
    const data = await res.json()

    expect(data.success).toBe(true)
    // 1 user gets 1 email with both changes
    expect(mockSendEmail).toHaveBeenCalledTimes(1)
    // Subject should mention 2 changes
    expect(mockSendEmail.mock.calls[0]![0].subject).toContain('2')
  })

  it('passes ai_summary from ChangeEvent to email template', async () => {
    const { GET } = await import(
      '@/app/api/cron/notify-amendment-changes/route'
    )
    mockPrisma.changeEvent.findMany.mockResolvedValue([CHANGE_EVENT_1])
    mockPrisma.amendmentDocument.findUnique.mockResolvedValue(AMENDMENT_DOC)
    mockResolveAffectedRecipients.mockResolvedValue([RECIPIENTS_DOC1[0]])

    await GET(makeRequest('Bearer test-secret'))

    // The react element props should contain the ai_summary from ChangeEvent
    const emailCall = mockSendEmail.mock.calls[0]![0]
    const reactElement = emailCall.react
    const changes = reactElement.props.changes as Array<{
      aiSummary: string | null
      assessUrl: string
    }>
    expect(changes[0]!.aiSummary).toBe('En ändring i arbetsmiljölagen.')
  })

  it('includes assessUrl deep-link in email data', async () => {
    const { GET } = await import(
      '@/app/api/cron/notify-amendment-changes/route'
    )
    mockPrisma.changeEvent.findMany.mockResolvedValue([CHANGE_EVENT_1])
    mockPrisma.amendmentDocument.findUnique.mockResolvedValue(AMENDMENT_DOC)
    mockResolveAffectedRecipients.mockResolvedValue([RECIPIENTS_DOC1[0]])

    await GET(makeRequest('Bearer test-secret'))

    const emailCall = mockSendEmail.mock.calls[0]![0]
    const reactElement = emailCall.react
    const changes = reactElement.props.changes as Array<{
      assessUrl: string
    }>
    expect(changes[0]!.assessUrl).toBe(
      'https://laglig.se/dashboard?changeId=ce-1'
    )
  })

  it('skips user with email preferences disabled', async () => {
    const { GET } = await import(
      '@/app/api/cron/notify-amendment-changes/route'
    )
    mockPrisma.changeEvent.findMany.mockResolvedValue([CHANGE_EVENT_1])
    mockPrisma.amendmentDocument.findUnique.mockResolvedValue(AMENDMENT_DOC)
    mockResolveAffectedRecipients.mockResolvedValue(RECIPIENTS_DOC1)

    // First user opted out, second user allowed
    mockShouldSendEmail.mockResolvedValueOnce(false).mockResolvedValueOnce(true)

    const res = await GET(makeRequest('Bearer test-secret'))
    const data = await res.json()

    expect(data.success).toBe(true)
    expect(data.stats.emailsSent).toBe(1)
    expect(mockSendEmail).toHaveBeenCalledTimes(1)
    expect(mockSendEmail.mock.calls[0]![0].to).toBe('bob@test.com')
  })

  it('breaks loop when approaching maxDuration timeout', async () => {
    const { GET } = await import(
      '@/app/api/cron/notify-amendment-changes/route'
    )
    mockPrisma.changeEvent.findMany.mockResolvedValue([
      CHANGE_EVENT_1,
      CHANGE_EVENT_2,
    ])
    mockPrisma.amendmentDocument.findUnique.mockResolvedValue(AMENDMENT_DOC)
    mockResolveAffectedRecipients.mockResolvedValue(RECIPIENTS_DOC1)

    // Simulate timeout: startTime = 0, all subsequent Date.now() calls
    // return a value past the (maxDuration - 30) * 1000 = 270s threshold
    const spy = vi.spyOn(Date, 'now')
    spy
      .mockReturnValueOnce(0) // startTime
      .mockReturnValue(271_000) // all subsequent: past 270s threshold

    const res = await GET(makeRequest('Bearer test-secret'))
    const data = await res.json()

    expect(data.success).toBe(true)
    // Events were found but enrichment loop broke before processing any
    expect(data.stats.amendmentsProcessed).toBe(2)
    expect(data.stats.emailsSent).toBe(0)
    // Amendment lookup should not have been reached
    expect(mockPrisma.amendmentDocument.findUnique).not.toHaveBeenCalled()

    spy.mockRestore()
  })

  it('per-workspace error isolation: failure in workspace A does not block workspace B', async () => {
    const { GET } = await import(
      '@/app/api/cron/notify-amendment-changes/route'
    )
    mockPrisma.changeEvent.findMany.mockResolvedValue([
      CHANGE_EVENT_1,
      CHANGE_EVENT_2,
    ])
    mockPrisma.amendmentDocument.findUnique.mockResolvedValue(AMENDMENT_DOC)

    // doc-1 → workspace A, doc-2 → workspace B
    mockResolveAffectedRecipients
      .mockResolvedValueOnce([
        {
          userId: 'user-1',
          email: 'alice@test.com',
          name: 'Alice',
          workspaceId: 'ws-1',
          workspaceName: 'Workspace A',
        },
      ])
      .mockResolvedValueOnce([
        {
          userId: 'user-3',
          email: 'carol@test.com',
          name: 'Carol',
          workspaceId: 'ws-2',
          workspaceName: 'Workspace B',
        },
      ])

    // shouldSendEmail throws for workspace A (realistic: DB connection error),
    // succeeds for workspace B
    mockShouldSendEmail
      .mockRejectedValueOnce(new Error('Database connection lost'))
      .mockResolvedValueOnce(true)

    const res = await GET(makeRequest('Bearer test-secret'))
    const data = await res.json()

    // Overall still succeeds — per-workspace error isolation
    expect(data.success).toBe(true)
    // Workspace B email should have been sent despite workspace A failure
    expect(mockSendEmail).toHaveBeenCalledTimes(1)
    expect(mockSendEmail.mock.calls[0]![0].to).toBe('carol@test.com')
  })

  it('calls processChangeEventNotifications before email delivery', async () => {
    const { GET } = await import(
      '@/app/api/cron/notify-amendment-changes/route'
    )
    mockPrisma.changeEvent.findMany.mockResolvedValue([CHANGE_EVENT_1])
    mockPrisma.amendmentDocument.findUnique.mockResolvedValue(AMENDMENT_DOC)
    mockResolveAffectedRecipients.mockResolvedValue(RECIPIENTS_DOC1)

    await GET(makeRequest('Bearer test-secret'))

    // processChangeEventNotifications should be called with all change event IDs
    expect(mockProcessChangeEventNotifications).toHaveBeenCalledWith(['ce-1'])
  })

  it('tracks correct stats (no content generation fields)', async () => {
    const { GET } = await import(
      '@/app/api/cron/notify-amendment-changes/route'
    )
    mockPrisma.changeEvent.findMany.mockResolvedValue([CHANGE_EVENT_1])
    mockPrisma.amendmentDocument.findUnique.mockResolvedValue(AMENDMENT_DOC)
    mockResolveAffectedRecipients.mockResolvedValue(RECIPIENTS_DOC1)

    mockProcessChangeEventNotifications.mockResolvedValue({
      notificationsCreated: 2,
      usersNotified: 2,
      workspacesAffected: 1,
      skippedByPreference: 0,
    })

    const res = await GET(makeRequest('Bearer test-secret'))
    const data = await res.json()

    expect(data.stats).toMatchObject({
      emailsSent: 2,
      emailsFailed: 0,
      amendmentsProcessed: 1,
      notificationsCreated: 2,
    })
    // Content generation fields should not exist
    expect(data.stats.contentGenerated).toBeUndefined()
    expect(data.stats.contentFailed).toBeUndefined()
  })

  it('sends admin summary email after processing', async () => {
    const { GET } = await import(
      '@/app/api/cron/notify-amendment-changes/route'
    )
    mockPrisma.changeEvent.findMany.mockResolvedValue([CHANGE_EVENT_1])
    mockPrisma.amendmentDocument.findUnique.mockResolvedValue(AMENDMENT_DOC)
    mockResolveAffectedRecipients.mockResolvedValue(RECIPIENTS_DOC1)

    await GET(makeRequest('Bearer test-secret'))

    // Admin email should be sent via sendHtmlEmail
    expect(mockSendHtmlEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        from: 'cron',
      })
    )
  })
})
