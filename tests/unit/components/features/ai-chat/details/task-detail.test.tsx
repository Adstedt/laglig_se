import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { TaskDetail } from '@/components/features/ai-chat/details/task-detail'
import type { TaskDetailData } from '@/lib/ai/chat-detail-context'

const mockTask: TaskDetailData = {
  id: 'task-1',
  title: 'Uppdatera riskbedömning',
  description: 'Granska kemikaliehantering enligt nya regler.',
  priority: 'HIGH',
  column: { id: 'col-1', name: 'Att göra', color: '#3b82f6', is_done: false },
  assignee: {
    id: 'user-1',
    name: 'Anna Svensson',
    email: 'anna@example.com',
    avatar_url: null,
  },
  created_at: new Date('2026-03-20'),
  list_item_links: [
    {
      law_list_item: {
        id: 'item-1',
        document: {
          title: 'Arbetsmiljölagen',
          document_number: 'SFS 1977:1160',
        },
        law_list: { id: 'list-1', name: 'Huvudlista' },
      },
    },
  ],
}

describe('TaskDetail', () => {
  it('renders all task fields', () => {
    render(<TaskDetail data={mockTask} />)

    expect(screen.getByText('Uppdatera riskbedömning')).toBeDefined()
    expect(
      screen.getByText('Granska kemikaliehantering enligt nya regler.')
    ).toBeDefined()
    expect(screen.getByText('Hög')).toBeDefined()
    expect(screen.getByText('Att göra')).toBeDefined()
    expect(screen.getByText('Anna Svensson')).toBeDefined()
    expect(screen.getByText('Arbetsmiljölagen')).toBeDefined()
    expect(screen.getByText('SFS 1977:1160')).toBeDefined()
  })

  it('shows "Ej tilldelad" when no assignee', () => {
    render(<TaskDetail data={{ ...mockTask, assignee: null }} />)
    expect(screen.getByText('Ej tilldelad')).toBeDefined()
  })

  it('renders navigation link', () => {
    render(<TaskDetail data={mockTask} />)
    expect(screen.getByText('Visa uppgift')).toBeDefined()
  })
})
