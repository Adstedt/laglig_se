/**
 * API endpoint to list all workspaces the current user has access to
 */

import { NextResponse } from 'next/server'
import { getUserWorkspaces } from '@/lib/auth/workspace-context'

export async function GET() {
  try {
    const workspaces = await getUserWorkspaces()
    return NextResponse.json({ workspaces })
  } catch (error) {
    console.error('Error fetching workspaces:', error)
    return NextResponse.json(
      { error: 'Failed to fetch workspaces' },
      { status: 500 }
    )
  }
}
