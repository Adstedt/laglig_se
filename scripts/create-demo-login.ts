/* eslint-disable no-console */
/**
 * Creates (or resets the password of) a confirmed Supabase auth user for
 * screenshot/demo sessions — so marketing captures never show a real
 * person's name in the topbar (Story 26.4, Input I-2).
 *
 * Pairs with scripts/seed-demo-workspace*.ts: seed first (creates the Prisma
 * user + workspace membership for the persona), then give that persona a
 * login here. NextAuth's credentials provider signs in via
 * supabase.auth.signInWithPassword, so a confirmed auth user with a password
 * is all a login needs.
 *
 * Run:
 *   DEMO_EMAIL=anna.lindqvist@nordviken.example DEMO_PASSWORD='...' \
 *     pnpm tsx scripts/create-demo-login.ts
 *
 * The password is whatever you pass — store it in your password manager;
 * it is intentionally never written to disk by this script.
 */
import { config as loadEnv } from 'dotenv'
import { resolve } from 'path'

loadEnv({ path: resolve(process.cwd(), '.env.local') })

// eslint-disable-next-line import/first
import { createClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const email = process.env.DEMO_EMAIL
const password = process.env.DEMO_PASSWORD

if (!url || !serviceKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}
if (!email || !password) {
  console.error(
    'Usage: DEMO_EMAIL=... DEMO_PASSWORD=... pnpm tsx scripts/create-demo-login.ts'
  )
  process.exit(1)
}
if (!email.endsWith('.example')) {
  console.error(
    `Refusing: "${email}" is not an .example address — demo logins must use ` +
      'reserved fictitious domains so they can never collide with a real person.'
  )
  process.exit(1)
}

const admin = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

async function main(): Promise<void> {
  const { data: created, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })

  if (!error) {
    console.log(
      `[create-demo-login] created confirmed auth user ${email} (id=${created.user?.id})`
    )
    return
  }

  // Already exists → reset the password instead (idempotent re-runs).
  if (/already.*(registered|exists)/i.test(error.message)) {
    const { data: list, error: listErr } = await admin.auth.admin.listUsers()
    if (listErr) throw listErr
    const existing = list.users.find((u) => u.email === email)
    if (!existing)
      throw new Error(`user exists but not found by listUsers: ${email}`)
    const { error: updateErr } = await admin.auth.admin.updateUserById(
      existing.id,
      {
        password,
        email_confirm: true,
      }
    )
    if (updateErr) throw updateErr
    console.log(
      `[create-demo-login] reset password for existing auth user ${email} (id=${existing.id})`
    )
    return
  }

  throw error
}

main().catch((err) => {
  console.error('[create-demo-login] failed:', err)
  process.exit(1)
})
