'use server'

import { revalidatePath } from 'next/cache'

import { getAdminSession } from '@/lib/admin/auth'
import { JOB_REGISTRY } from '@/lib/admin/job-registry'

export async function triggerJob(
  jobName: string
): Promise<{ success: boolean; error?: string | undefined }> {
  try {
    const session = await getAdminSession()
    if (!session) return { success: false, error: 'Ej autentiserad' }

    const job = JOB_REGISTRY.find((j) => j.name === jobName)
    if (!job) return { success: false, error: 'Okänt jobb' }

    const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000'
    const url = `${baseUrl}${job.endpoint}`

    // Fire-and-forget — cron endpoints block until completion (up to 5 min)
    fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${process.env[job.authHeader]}`,
        'x-triggered-by': session.email,
      },
    }).catch((err) => {
      console.error(`Failed to trigger ${jobName}:`, err)
    })

    revalidatePath('/admin/cron-jobs')

    return { success: true }
  } catch {
    return { success: false, error: 'Ett oväntat fel uppstod' }
  }
}
