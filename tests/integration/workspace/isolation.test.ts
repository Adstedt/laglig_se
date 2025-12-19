/**
 * Story 5.1: Integration tests for workspace data isolation
 * Tests that workspace data is properly isolated and soft-delete works correctly.
 */

import { describe, test, expect, beforeAll, afterAll } from 'vitest'
import { prisma } from '@/lib/prisma'
import {
  softDeleteWorkspace,
  restoreWorkspace,
} from '@/lib/workspace/workspace-operations'
import { WorkspaceAccessError } from '@/lib/auth/workspace-context'

// Test data IDs (use UUIDs to avoid collisions)
const TEST_PREFIX = 'test-5.1-'
let userAId: string
let userBId: string
let workspaceAId: string
let workspaceBId: string
let _lawListAId: string
let lawListBId: string

describe('Workspace Data Isolation', () => {
  beforeAll(async () => {
    // Clean up any existing test data
    await cleanupTestData()

    // Create test users
    const userA = await prisma.user.create({
      data: {
        id: `${TEST_PREFIX}user-a`,
        email: `${TEST_PREFIX}user-a@test.com`,
        name: 'User A',
      },
    })
    userAId = userA.id

    const userB = await prisma.user.create({
      data: {
        id: `${TEST_PREFIX}user-b`,
        email: `${TEST_PREFIX}user-b@test.com`,
        name: 'User B',
      },
    })
    userBId = userB.id

    // Create workspace A owned by User A
    const workspaceA = await prisma.workspace.create({
      data: {
        id: `${TEST_PREFIX}workspace-a`,
        name: 'Workspace A',
        slug: `${TEST_PREFIX}workspace-a`,
        owner_id: userAId,
        members: {
          create: {
            user_id: userAId,
            role: 'OWNER',
          },
        },
      },
    })
    workspaceAId = workspaceA.id

    // Create workspace B owned by User B
    const workspaceB = await prisma.workspace.create({
      data: {
        id: `${TEST_PREFIX}workspace-b`,
        name: 'Workspace B',
        slug: `${TEST_PREFIX}workspace-b`,
        owner_id: userBId,
        members: {
          create: {
            user_id: userBId,
            role: 'OWNER',
          },
        },
      },
    })
    workspaceBId = workspaceB.id

    // Create law list in Workspace A
    const lawListA = await prisma.lawList.create({
      data: {
        id: `${TEST_PREFIX}lawlist-a`,
        workspace_id: workspaceAId,
        name: 'Law List A',
        created_by: userAId,
      },
    })
    _lawListAId = lawListA.id

    // Create law list in Workspace B
    const lawListB = await prisma.lawList.create({
      data: {
        id: `${TEST_PREFIX}lawlist-b`,
        workspace_id: workspaceBId,
        name: 'Law List B',
        created_by: userBId,
      },
    })
    lawListBId = lawListB.id
  })

  afterAll(async () => {
    await cleanupTestData()
  })

  test('User A cannot query User B workspace data via direct query', async () => {
    // User A queries their workspaces
    const userAWorkspaces = await prisma.workspace.findMany({
      where: {
        members: {
          some: {
            user_id: userAId,
          },
        },
      },
    })

    // Should only see Workspace A
    expect(userAWorkspaces).toHaveLength(1)
    expect(userAWorkspaces[0]?.id).toBe(workspaceAId)
    expect(userAWorkspaces[0]?.name).toBe('Workspace A')

    // Verify User B's workspace is NOT included
    const workspaceBInResults = userAWorkspaces.find(
      (w) => w.id === workspaceBId
    )
    expect(workspaceBInResults).toBeUndefined()
  })

  test('Law lists are scoped to workspace', async () => {
    // Query law lists for Workspace A
    const workspaceALawLists = await prisma.lawList.findMany({
      where: {
        workspace_id: workspaceAId,
      },
    })

    expect(workspaceALawLists).toHaveLength(1)
    expect(workspaceALawLists[0]?.name).toBe('Law List A')

    // Query law lists for Workspace B
    const workspaceBLawLists = await prisma.lawList.findMany({
      where: {
        workspace_id: workspaceBId,
      },
    })

    expect(workspaceBLawLists).toHaveLength(1)
    expect(workspaceBLawLists[0]?.name).toBe('Law List B')

    // Cross-workspace query should return empty
    const crossQuery = await prisma.lawList.findFirst({
      where: {
        workspace_id: workspaceAId,
        id: lawListBId,
      },
    })
    expect(crossQuery).toBeNull()
  })

  test('Soft delete hides workspace from queries', async () => {
    // Create a workspace to soft-delete
    const testWorkspace = await prisma.workspace.create({
      data: {
        id: `${TEST_PREFIX}workspace-delete-test`,
        name: 'Delete Test Workspace',
        slug: `${TEST_PREFIX}workspace-delete-test`,
        owner_id: userAId,
        members: {
          create: {
            user_id: userAId,
            role: 'OWNER',
          },
        },
      },
    })

    // Verify it's visible
    let workspace = await prisma.workspace.findUnique({
      where: { id: testWorkspace.id },
    })
    expect(workspace).not.toBeNull()
    expect(workspace?.status).toBe('ACTIVE')

    // Soft delete the workspace
    await softDeleteWorkspace(testWorkspace.id, userAId)

    // Query for active workspaces should not include deleted workspace
    const activeWorkspaces = await prisma.workspace.findMany({
      where: {
        members: {
          some: {
            user_id: userAId,
          },
        },
        status: 'ACTIVE',
      },
    })

    const deletedInActive = activeWorkspaces.find(
      (w) => w.id === testWorkspace.id
    )
    expect(deletedInActive).toBeUndefined()

    // Direct query still finds it (but with DELETED status)
    workspace = await prisma.workspace.findUnique({
      where: { id: testWorkspace.id },
    })
    expect(workspace?.status).toBe('DELETED')
    expect(workspace?.deleted_at).not.toBeNull()

    // Clean up
    await prisma.workspace.delete({ where: { id: testWorkspace.id } })
  })

  test('Only workspace owner can soft-delete workspace', async () => {
    // Create a test workspace
    const testWorkspace = await prisma.workspace.create({
      data: {
        id: `${TEST_PREFIX}workspace-owner-test`,
        name: 'Owner Test Workspace',
        slug: `${TEST_PREFIX}workspace-owner-test`,
        owner_id: userAId,
        members: {
          create: [
            { user_id: userAId, role: 'OWNER' },
            { user_id: userBId, role: 'MEMBER' },
          ],
        },
      },
    })

    // User B (member) tries to delete - should fail
    await expect(
      softDeleteWorkspace(testWorkspace.id, userBId)
    ).rejects.toThrow(WorkspaceAccessError)

    // User A (owner) can delete
    await expect(
      softDeleteWorkspace(testWorkspace.id, userAId)
    ).resolves.not.toThrow()

    // Clean up
    await prisma.workspace.delete({ where: { id: testWorkspace.id } })
  })

  test('Workspace can be restored within 30 days', async () => {
    // Create and soft-delete a workspace
    const testWorkspace = await prisma.workspace.create({
      data: {
        id: `${TEST_PREFIX}workspace-restore-test`,
        name: 'Restore Test Workspace',
        slug: `${TEST_PREFIX}workspace-restore-test`,
        owner_id: userAId,
        members: {
          create: {
            user_id: userAId,
            role: 'OWNER',
          },
        },
      },
    })

    await softDeleteWorkspace(testWorkspace.id, userAId)

    // Verify it's deleted
    let workspace = await prisma.workspace.findUnique({
      where: { id: testWorkspace.id },
    })
    expect(workspace?.status).toBe('DELETED')

    // Restore the workspace
    await restoreWorkspace(testWorkspace.id, userAId)

    // Verify it's active again
    workspace = await prisma.workspace.findUnique({
      where: { id: testWorkspace.id },
    })
    expect(workspace?.status).toBe('ACTIVE')
    expect(workspace?.deleted_at).toBeNull()

    // Clean up
    await prisma.workspace.delete({ where: { id: testWorkspace.id } })
  })

  test('Cascade delete removes all related data', async () => {
    // Create a workspace with company profile and law list
    const testWorkspace = await prisma.workspace.create({
      data: {
        id: `${TEST_PREFIX}workspace-cascade-test`,
        name: 'Cascade Test Workspace',
        slug: `${TEST_PREFIX}workspace-cascade-test`,
        owner_id: userAId,
        members: {
          create: {
            user_id: userAId,
            role: 'OWNER',
          },
        },
        company_profile: {
          create: {
            company_name: 'Test Company',
            sni_code: '62010',
            legal_form: 'AB',
            employee_count: 10,
          },
        },
        law_lists: {
          create: {
            name: 'Cascade Test Law List',
            created_by: userAId,
          },
        },
      },
    })

    // Verify related data exists
    const profile = await prisma.companyProfile.findUnique({
      where: { workspace_id: testWorkspace.id },
    })
    expect(profile).not.toBeNull()

    const lawLists = await prisma.lawList.findMany({
      where: { workspace_id: testWorkspace.id },
    })
    expect(lawLists).toHaveLength(1)

    // Hard delete the workspace
    await prisma.workspace.delete({ where: { id: testWorkspace.id } })

    // Verify related data is gone (cascade delete)
    const profileAfter = await prisma.companyProfile.findUnique({
      where: { workspace_id: testWorkspace.id },
    })
    expect(profileAfter).toBeNull()

    const lawListsAfter = await prisma.lawList.findMany({
      where: { workspace_id: testWorkspace.id },
    })
    expect(lawListsAfter).toHaveLength(0)
  })

  test('Workspace membership query respects user scope', async () => {
    // Query memberships for User A
    const userAMemberships = await prisma.workspaceMember.findMany({
      where: {
        user_id: userAId,
      },
      include: {
        workspace: true,
      },
    })

    // Should only include Workspace A membership
    expect(userAMemberships.length).toBeGreaterThanOrEqual(1)
    const workspaceAMembership = userAMemberships.find(
      (m) => m.workspace_id === workspaceAId
    )
    expect(workspaceAMembership).toBeDefined()

    // Should NOT include Workspace B membership
    const workspaceBMembership = userAMemberships.find(
      (m) => m.workspace_id === workspaceBId
    )
    expect(workspaceBMembership).toBeUndefined()
  })
})

/**
 * Clean up test data created during tests
 */
async function cleanupTestData() {
  // Delete in correct order to respect foreign key constraints
  await prisma.lawListItem.deleteMany({
    where: {
      law_list: {
        workspace_id: { startsWith: TEST_PREFIX },
      },
    },
  })

  await prisma.lawList.deleteMany({
    where: { id: { startsWith: TEST_PREFIX } },
  })

  await prisma.companyProfile.deleteMany({
    where: { workspace_id: { startsWith: TEST_PREFIX } },
  })

  await prisma.workspaceMember.deleteMany({
    where: { workspace_id: { startsWith: TEST_PREFIX } },
  })

  await prisma.workspace.deleteMany({
    where: { id: { startsWith: TEST_PREFIX } },
  })

  await prisma.user.deleteMany({
    where: { id: { startsWith: TEST_PREFIX } },
  })
}
