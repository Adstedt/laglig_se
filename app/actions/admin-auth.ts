'use server'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'
import { z } from 'zod'
import {
  isAdminEmail,
  createAdminToken,
  ADMIN_SESSION_COOKIE,
} from '@/lib/admin/auth'

const AdminLoginSchema = z.object({
  email: z.string().email('Ogiltig e-postadress'),
  password: z.string().min(1, 'Lösenord krävs'),
})

export async function adminLogin(
  formData: FormData
): Promise<{ success: boolean; error?: string | undefined }> {
  try {
    const raw = {
      email: formData.get('email'),
      password: formData.get('password'),
    }

    const parsed = AdminLoginSchema.safeParse(raw)
    if (!parsed.success) {
      return { success: false, error: 'Ogiltiga inloggningsuppgifter' }
    }

    const { email, password } = parsed.data

    // Verify credentials via Supabase Auth
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      return { success: false, error: 'Ogiltiga inloggningsuppgifter' }
    }

    // Check admin allowlist
    if (!isAdminEmail(email)) {
      return {
        success: false,
        error: 'Åtkomst nekad. Ditt konto har inte adminbehörighet.',
      }
    }

    // Create admin JWT and set cookie
    const token = await createAdminToken(email)
    const cookieStore = await cookies()
    cookieStore.set(ADMIN_SESSION_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 60 * 60 * 24, // 24 hours
      path: '/admin',
    })
  } catch {
    return {
      success: false,
      error: 'Ett oväntat fel uppstod. Försök igen.',
    }
  }

  redirect('/admin/dashboard')
}

export async function adminLogout(): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.set(ADMIN_SESSION_COOKIE, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 0,
    path: '/admin',
  })

  redirect('/admin/login')
}
