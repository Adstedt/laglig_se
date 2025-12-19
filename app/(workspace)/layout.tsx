import { getCurrentUser } from '@/lib/auth/session'
import { redirect } from 'next/navigation'
import { WorkspaceShell } from '@/components/layout/workspace-shell'

export default async function WorkspaceLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const user = await getCurrentUser()

  if (!user) {
    redirect('/login')
  }

  return <WorkspaceShell user={user}>{children}</WorkspaceShell>
}
