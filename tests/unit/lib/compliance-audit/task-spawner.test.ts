/**
 * Story 21.8 — spawnCorrectiveActionTask unit tests.
 *
 * Mocks a `Prisma.TransactionClient` via a duck-typed stub. Mirrors the
 * Story 21.14 AC 11 `as unknown as Prisma.TransactionClient` pattern.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Prisma } from '@prisma/client'
import { TaskPriority } from '@prisma/client'
import { spawnCorrectiveActionTask } from '@/lib/compliance-audit/task-spawner'

const WORKSPACE_ID = '11111111-1111-4111-8111-111111111111'
const CYCLE_ID = '22222222-2222-4222-8222-222222222222'
const FINDING_ID = '33333333-3333-4333-8333-333333333333'
const USER_ID = '44444444-4444-4444-8444-444444444444'
const LEAD_AUDITOR_ID = '55555555-5555-4555-8555-555555555555'
const ITEM_RESPONSIBLE_ID = '66666666-6666-4666-8666-666666666666'
const OPEN_COLUMN_ID = '77777777-7777-4777-8777-777777777777'
const CREATED_TASK_ID = '88888888-8888-4888-8888-888888888888'

type StubTx = {
  taskColumn: {
    findMany: ReturnType<typeof vi.fn>
    findFirst: ReturnType<typeof vi.fn>
    create: ReturnType<typeof vi.fn>
  }
  task: {
    aggregate: ReturnType<typeof vi.fn>
    create: ReturnType<typeof vi.fn>
  }
  complianceCycleTaskLink: {
    create: ReturnType<typeof vi.fn>
  }
}

function makeStubTx(): StubTx {
  return {
    taskColumn: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
    },
    task: {
      aggregate: vi.fn(),
      create: vi.fn(),
    },
    complianceCycleTaskLink: {
      create: vi.fn(),
    },
  }
}

function makeArgs(
  overrides: Partial<Parameters<typeof spawnCorrectiveActionTask>[1]> = {}
) {
  return {
    workspaceId: WORKSPACE_ID,
    cycleId: CYCLE_ID,
    cycleName: 'Test Cycle',
    leadAuditorUserId: LEAD_AUDITOR_ID,
    itemResponsibleUserId: null,
    finding: {
      id: FINDING_ID,
      title: 'Test Finding',
      description: 'Finding description body.',
      dueDate: new Date('2026-05-15T00:00:00Z'),
    },
    createdByUserId: USER_ID,
    ...overrides,
  }
}

function defaultHappyPath(tx: StubTx) {
  tx.taskColumn.findMany.mockResolvedValue([{ id: OPEN_COLUMN_ID }])
  tx.task.aggregate.mockResolvedValue({ _max: { position: 2 } })
  tx.task.create.mockResolvedValue({ id: CREATED_TASK_ID })
  tx.complianceCycleTaskLink.create.mockResolvedValue({})
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('spawnCorrectiveActionTask', () => {
  it('happy path: item-linked finding — assignee = itemResponsibleUserId', async () => {
    const tx = makeStubTx()
    defaultHappyPath(tx)

    const result = await spawnCorrectiveActionTask(
      tx as unknown as Prisma.TransactionClient,
      makeArgs({ itemResponsibleUserId: ITEM_RESPONSIBLE_ID })
    )

    expect(result).toEqual({
      taskId: CREATED_TASK_ID,
      columnId: OPEN_COLUMN_ID,
      assigneeId: ITEM_RESPONSIBLE_ID,
    })
    expect(tx.task.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        workspace_id: WORKSPACE_ID,
        column_id: OPEN_COLUMN_ID,
        title: 'Test Finding',
        description:
          'Korrigerande åtgärd för avvikelse: Finding description body.',
        assignee_id: ITEM_RESPONSIBLE_ID,
        created_by: USER_ID,
        due_date: new Date('2026-05-15T00:00:00Z'),
        priority: TaskPriority.HIGH,
        position: 3,
        compliance_finding_id: FINDING_ID,
      }),
      select: { id: true },
    })
    // DEV-001: returned assigneeId matches the Task row's assignee_id (single source of truth).
    const taskCreateCall = tx.task.create.mock.calls[0][0]
    expect(result.assigneeId).toBe(taskCreateCall.data.assignee_id)
  })

  it('happy path: cycle-level finding — assignee falls back to leadAuditorUserId', async () => {
    const tx = makeStubTx()
    defaultHappyPath(tx)

    const result = await spawnCorrectiveActionTask(
      tx as unknown as Prisma.TransactionClient,
      makeArgs() // itemResponsibleUserId is null by default
    )

    expect(tx.task.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        assignee_id: LEAD_AUDITOR_ID,
      }),
      select: { id: true },
    })
    // DEV-001: returned assigneeId reflects the fallback to leadAuditorUserId.
    expect(result.assigneeId).toBe(LEAD_AUDITOR_ID)
  })

  it('item responsible is null → falls back to leadAuditorUserId', async () => {
    const tx = makeStubTx()
    defaultHappyPath(tx)

    await spawnCorrectiveActionTask(
      tx as unknown as Prisma.TransactionClient,
      makeArgs({ itemResponsibleUserId: null })
    )

    const call = tx.task.create.mock.calls[0][0]
    expect(call.data.assignee_id).toBe(LEAD_AUDITOR_ID)
  })

  it('no columns in workspace — helper creates default "Att göra"', async () => {
    const tx = makeStubTx()
    tx.taskColumn.findMany.mockResolvedValue([])
    tx.taskColumn.findFirst.mockResolvedValue(null) // truly no columns
    const CREATED_COLUMN_ID = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
    tx.taskColumn.create.mockResolvedValue({ id: CREATED_COLUMN_ID })
    tx.task.aggregate.mockResolvedValue({ _max: { position: null } })
    tx.task.create.mockResolvedValue({ id: CREATED_TASK_ID })
    tx.complianceCycleTaskLink.create.mockResolvedValue({})

    const result = await spawnCorrectiveActionTask(
      tx as unknown as Prisma.TransactionClient,
      makeArgs()
    )

    expect(tx.taskColumn.create).toHaveBeenCalledWith({
      data: {
        workspace_id: WORKSPACE_ID,
        name: 'Att göra',
        color: '#6b7280',
        position: 0,
        is_default: true,
        is_done: false,
      },
      select: { id: true },
    })
    expect(result.columnId).toBe(CREATED_COLUMN_ID)
  })

  it('only is_done columns exist — throws', async () => {
    const tx = makeStubTx()
    tx.taskColumn.findMany.mockResolvedValue([])
    tx.taskColumn.findFirst.mockResolvedValue({ id: 'done-column' })

    await expect(
      spawnCorrectiveActionTask(
        tx as unknown as Prisma.TransactionClient,
        makeArgs()
      )
    ).rejects.toThrow('Ingen öppen uppgiftskolumn i arbetsytan')

    expect(tx.task.create).not.toHaveBeenCalled()
    expect(tx.complianceCycleTaskLink.create).not.toHaveBeenCalled()
  })

  it('position calculation: target column has existing tasks → next position', async () => {
    const tx = makeStubTx()
    defaultHappyPath(tx)
    tx.task.aggregate.mockResolvedValue({ _max: { position: 7 } })

    await spawnCorrectiveActionTask(
      tx as unknown as Prisma.TransactionClient,
      makeArgs()
    )

    expect(tx.task.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ position: 8 }),
      select: { id: true },
    })
  })

  it('empty target column: max(position) null → position 0', async () => {
    const tx = makeStubTx()
    defaultHappyPath(tx)
    tx.task.aggregate.mockResolvedValue({ _max: { position: null } })

    await spawnCorrectiveActionTask(
      tx as unknown as Prisma.TransactionClient,
      makeArgs()
    )

    expect(tx.task.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ position: 0 }),
      select: { id: true },
    })
  })

  it('PO v0.5 — cycle link row written exactly once', async () => {
    const tx = makeStubTx()
    defaultHappyPath(tx)

    await spawnCorrectiveActionTask(
      tx as unknown as Prisma.TransactionClient,
      makeArgs()
    )

    expect(tx.complianceCycleTaskLink.create).toHaveBeenCalledTimes(1)
    expect(tx.complianceCycleTaskLink.create).toHaveBeenCalledWith({
      data: {
        task_id: CREATED_TASK_ID,
        cycle_id: CYCLE_ID,
      },
    })
  })

  it('PO v0.5 — link row uses the newly created task id (order invariant)', async () => {
    const tx = makeStubTx()
    defaultHappyPath(tx)

    await spawnCorrectiveActionTask(
      tx as unknown as Prisma.TransactionClient,
      makeArgs()
    )

    const taskCreateCallIdx = tx.task.create.mock.invocationCallOrder[0]
    const linkCreateCallIdx =
      tx.complianceCycleTaskLink.create.mock.invocationCallOrder[0]
    expect(linkCreateCallIdx).toBeGreaterThan(taskCreateCallIdx)
    expect(
      tx.complianceCycleTaskLink.create.mock.calls[0][0].data.task_id
    ).toBe(CREATED_TASK_ID)
  })

  it('PO v0.5 — link create failure propagates', async () => {
    const tx = makeStubTx()
    defaultHappyPath(tx)
    tx.complianceCycleTaskLink.create.mockRejectedValue(
      new Error('link constraint violation')
    )

    await expect(
      spawnCorrectiveActionTask(
        tx as unknown as Prisma.TransactionClient,
        makeArgs()
      )
    ).rejects.toThrow('link constraint violation')
  })

  it('description truncation: no truncation — passes full finding description', async () => {
    const tx = makeStubTx()
    defaultHappyPath(tx)
    const longDesc = 'A'.repeat(5000)

    await spawnCorrectiveActionTask(
      tx as unknown as Prisma.TransactionClient,
      makeArgs({
        finding: {
          id: FINDING_ID,
          title: 'T',
          description: longDesc,
          dueDate: null,
        },
      })
    )

    const createCall = tx.task.create.mock.calls[0][0]
    expect(createCall.data.description).toBe(
      'Korrigerande åtgärd för avvikelse: ' + longDesc
    )
    expect(createCall.data.description.length).toBe(35 + 5000)
  })
})
