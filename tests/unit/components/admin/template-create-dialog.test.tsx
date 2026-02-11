import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi, describe, beforeEach, it, expect } from 'vitest'

const mockPush = vi.fn()

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    prefetch: vi.fn(),
    refresh: vi.fn(),
  }),
}))

vi.mock('@/app/actions/admin-templates', () => ({
  createTemplate: vi.fn(),
}))

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}))

import { TemplateCreateDialog } from '@/components/admin/template-create-dialog'
import { createTemplate } from '@/app/actions/admin-templates'

const mockCreateTemplate = vi.mocked(createTemplate)

describe('TemplateCreateDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders dialog when open', () => {
    render(<TemplateCreateDialog open={true} onOpenChange={vi.fn()} />)

    expect(screen.getByText('Skapa mall')).toBeInTheDocument()
    expect(screen.getByLabelText('Namn *')).toBeInTheDocument()
    expect(screen.getByLabelText('Domän *')).toBeInTheDocument()
  })

  it('validates required fields on submit', async () => {
    const user = userEvent.setup()

    render(<TemplateCreateDialog open={true} onOpenChange={vi.fn()} />)

    const submitButton = screen.getByRole('button', { name: 'Skapa' })
    await user.click(submitButton)

    await waitFor(() => {
      expect(screen.getByText('Namn krävs')).toBeInTheDocument()
    })

    expect(mockCreateTemplate).not.toHaveBeenCalled()
  })

  it('auto-generates slug from name on blur', async () => {
    const user = userEvent.setup()

    render(<TemplateCreateDialog open={true} onOpenChange={vi.fn()} />)

    const nameInput = screen.getByLabelText('Namn *')
    await user.type(nameInput, 'Arbetsmiljö Test')
    fireEvent.blur(nameInput)

    const slugInput = screen.getByLabelText('Slug') as HTMLInputElement
    await waitFor(() => {
      expect(slugInput.value).toBe('arbetsmiljo-test')
    })
  })

  it('submits form and redirects on success', async () => {
    const user = userEvent.setup()
    const onOpenChange = vi.fn()
    mockCreateTemplate.mockResolvedValue({
      success: true,
      templateId: 'new-tmpl-1',
    })

    render(<TemplateCreateDialog open={true} onOpenChange={onOpenChange} />)

    await user.type(screen.getByLabelText('Namn *'), 'Ny Mall')
    fireEvent.blur(screen.getByLabelText('Namn *'))
    await user.type(screen.getByLabelText('Domän *'), 'Arbetsmiljö')

    const submitButton = screen.getByRole('button', { name: 'Skapa' })
    await user.click(submitButton)

    await waitFor(() => {
      expect(mockCreateTemplate).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Ny Mall',
          domain: 'Arbetsmiljö',
          slug: 'ny-mall',
        })
      )
    })

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/admin/templates/new-tmpl-1')
    })
  })

  it('shows server error on failure', async () => {
    const user = userEvent.setup()
    mockCreateTemplate.mockResolvedValue({
      success: false,
      error: 'En mall med denna slug finns redan',
    })

    render(<TemplateCreateDialog open={true} onOpenChange={vi.fn()} />)

    await user.type(screen.getByLabelText('Namn *'), 'Duplicate')
    fireEvent.blur(screen.getByLabelText('Namn *'))
    await user.type(screen.getByLabelText('Domän *'), 'Test')

    await user.click(screen.getByRole('button', { name: 'Skapa' }))

    await waitFor(() => {
      expect(
        screen.getByText('En mall med denna slug finns redan')
      ).toBeInTheDocument()
    })
  })
})
