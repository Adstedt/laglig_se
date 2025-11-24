import { describe, it, expect, afterAll } from 'vitest'
import { prisma } from '@/lib/prisma'
import { createClient } from '@supabase/supabase-js'

/**
 * Integration test to verify user synchronization between Supabase Auth and Prisma
 *
 * This test verifies that:
 * 1. When a user signs up via Supabase Auth, they are created in Supabase
 * 2. When they log in via NextAuth, a Prisma user record is created via upsert
 * 3. Subsequent logins update the last_login_at timestamp
 */

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const TEST_USER = {
  email: `test-${Date.now()}@example.com`,
  password: 'TestPassword123!',
  name: 'Test User',
}

describe('User Synchronization Integration Test', () => {
  let testUserId: string

  afterAll(async () => {
    // Cleanup: Delete test user from both Supabase and Prisma
    if (testUserId) {
      try {
        await prisma.user.delete({ where: { id: testUserId } })
      } catch {
        // Prisma cleanup skipped (user may not exist)
      }

      // Note: Supabase Auth user cleanup requires admin API
      // For now, we'll leave test users in Supabase (they have unique emails)
    }
  })

  it('should create user in Supabase Auth on signup', async () => {
    const { data, error } = await supabase.auth.signUp({
      email: TEST_USER.email,
      password: TEST_USER.password,
      options: {
        data: {
          name: TEST_USER.name,
        },
      },
    })

    expect(error).toBeNull()
    expect(data.user).toBeDefined()
    expect(data.user?.email).toBe(TEST_USER.email)

    testUserId = data.user!.id
  })

  it('should NOT have Prisma user record immediately after signup', async () => {
    const prismaUser = await prisma.user.findUnique({
      where: { email: TEST_USER.email },
    })

    expect(prismaUser).toBeNull()
  })

  it('should create Prisma user on first login (via NextAuth authorize callback)', async () => {
    // Simulate the NextAuth authorize callback logic
    const { data: authData, error: authError } =
      await supabase.auth.signInWithPassword({
        email: TEST_USER.email,
        password: TEST_USER.password,
      })

    expect(authError).toBeNull()
    expect(authData.user).toBeDefined()

    // This is what the NextAuth authorize callback does
    await prisma.user.upsert({
      where: { email: TEST_USER.email },
      update: {
        last_login_at: new Date(),
      },
      create: {
        id: authData.user!.id,
        email: TEST_USER.email,
        name: TEST_USER.name,
        email_verified: authData.user!.email_confirmed_at !== null,
      },
    })

    // Verify Prisma user was created
    const prismaUser = await prisma.user.findUnique({
      where: { email: TEST_USER.email },
    })

    expect(prismaUser).toBeDefined()
    expect(prismaUser?.email).toBe(TEST_USER.email)
    expect(prismaUser?.name).toBe(TEST_USER.name)
    expect(prismaUser?.id).toBe(authData.user!.id)
  })

  it('should update last_login_at on subsequent logins', async () => {
    const firstLogin = await prisma.user.findUnique({
      where: { email: TEST_USER.email },
      select: { last_login_at: true },
    })

    // Wait 1 second to ensure timestamp is different
    await new Promise((resolve) => setTimeout(resolve, 1000))

    // Simulate second login
    const { data: authData } = await supabase.auth.signInWithPassword({
      email: TEST_USER.email,
      password: TEST_USER.password,
    })

    await prisma.user.upsert({
      where: { email: TEST_USER.email },
      update: {
        last_login_at: new Date(),
      },
      create: {
        id: authData.user!.id,
        email: TEST_USER.email,
        name: TEST_USER.name,
        email_verified: authData.user!.email_confirmed_at !== null,
      },
    })

    const secondLogin = await prisma.user.findUnique({
      where: { email: TEST_USER.email },
      select: { last_login_at: true },
    })

    expect(secondLogin?.last_login_at).toBeDefined()
    expect(secondLogin?.last_login_at?.getTime()).toBeGreaterThan(
      firstLogin?.last_login_at?.getTime() || 0
    )
  })
})
