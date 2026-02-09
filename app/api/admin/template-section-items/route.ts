import { NextResponse } from 'next/server'

import { getAdminSession } from '@/lib/admin/auth'
import { getTemplateSectionItems } from '@/lib/admin/template-queries'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const session = await getAdminSession()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const sectionId = searchParams.get('sectionId')

  if (!sectionId) {
    return NextResponse.json(
      { error: 'sectionId is required' },
      { status: 400 }
    )
  }

  const items = await getTemplateSectionItems(sectionId)
  return NextResponse.json({ items })
}
