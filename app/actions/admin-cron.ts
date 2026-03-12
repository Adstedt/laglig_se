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

    // On Vercel, VERCEL_URL points to the current deployment — use it to
    // avoid hitting the production domain from preview deployments.
    const baseUrl = process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : process.env.NEXTAUTH_URL || 'http://localhost:3000'
    const url = `${baseUrl}${job.endpoint}`

    const headers: Record<string, string> = {
      Authorization: `Bearer ${process.env[job.authHeader]}`,
      'x-triggered-by': session.email,
    }

    // Bypass Vercel Deployment Protection on preview deployments.
    // https://vercel.com/docs/security/deployment-protection/methods-to-bypass-deployment-protection/protection-bypass-automation
    if (process.env.VERCEL_AUTOMATION_BYPASS_SECRET) {
      headers['x-vercel-protection-bypass'] =
        process.env.VERCEL_AUTOMATION_BYPASS_SECRET
    }

    // Fire-and-forget — cron endpoints can run for several minutes
    fetch(url, { method: 'GET', headers }).catch((err) => {
      console.error(`Failed to trigger ${jobName}:`, err)
    })

    revalidatePath('/admin/cron-jobs')

    return { success: true }
  } catch {
    return { success: false, error: 'Ett oväntat fel uppstod' }
  }
}
