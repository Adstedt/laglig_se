import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi, describe, beforeEach, it, expect } from 'vitest'

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    prefetch: vi.fn(),
    refresh: vi.fn(),
  }),
  useSearchParams: () => new URLSearchParams(),
}))

vi.mock('@/app/actions/admin-templates', () => ({
  updateTemplate: vi.fn(),
}))

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}))

import { TemplateEditForm } from '@/components/admin/template-edit-form'
import { updateTemplate } from '@/app/actions/admin-templates'
import { toast } from 'sonner'

const mockUpdateTemplate = vi.mocked(updateTemplate)

const mockTemplate = {
  id: 'tmpl-1',
  name: 'Arbetsmiljö',
  slug: 'arbetsmiljo',
  description: 'En beskrivning',
  domain: 'Arbetsmiljö',
  target_audience: 'HR-ansvariga',
  primary_regulatory_bodies: ['Arbetsmiljöverket'],
}

describe('TemplateEditForm', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders form with template data', () => {
    render(
      <TemplateEditForm
        template={mockTemplate}
        onCancel={vi.fn()}
        onSaved={vi.fn()}
      />
    )

    expect((screen.getByLabelText('Namn *') as HTMLInputElement).value).toBe(
      'Arbetsmiljö'
    )
    expect((screen.getByLabelText('Domän *') as HTMLInputElement).value).toBe(
      'Arbetsmiljö'
    )
    expect((screen.getByLabelText('Slug') as HTMLInputElement).value).toBe(
      'arbetsmiljo'
    )
  })

  it('validates required fields', async () => {
    const user = userEvent.setup()

    render(
      <TemplateEditForm
        template={mockTemplate}
        onCancel={vi.fn()}
        onSaved={vi.fn()}
      />
    )

    // Clear required field
    const nameInput = screen.getByLabelText('Namn *')
    await user.clear(nameInput)
    await user.click(screen.getByRole('button', { name: 'Spara' }))

    await waitFor(() => {
      expect(screen.getByText('Namn krävs')).toBeInTheDocument()
    })

    expect(mockUpdateTemplate).not.toHaveBeenCalled()
  })

  it('calls updateTemplate with correct data on submit', async () => {
    const user = userEvent.setup()
    const onSaved = vi.fn()
    mockUpdateTemplate.mockResolvedValue({ success: true })

    render(
      <TemplateEditForm
        template={mockTemplate}
        onCancel={vi.fn()}
        onSaved={onSaved}
      />
    )

    const nameInput = screen.getByLabelText('Namn *')
    await user.clear(nameInput)
    await user.type(nameInput, 'Uppdaterad Mall')

    await user.click(screen.getByRole('button', { name: 'Spara' }))

    await waitFor(() => {
      expect(mockUpdateTemplate).toHaveBeenCalledWith(
        'tmpl-1',
        expect.objectContaining({
          name: 'Uppdaterad Mall',
          domain: 'Arbetsmiljö',
          primary_regulatory_bodies: ['Arbetsmiljöverket'],
        })
      )
    })

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith('Mallen har uppdaterats')
    })
  })

  it('calls onCancel when cancel button is clicked', async () => {
    const user = userEvent.setup()
    const onCancel = vi.fn()

    render(
      <TemplateEditForm
        template={mockTemplate}
        onCancel={onCancel}
        onSaved={vi.fn()}
      />
    )

    await user.click(screen.getByRole('button', { name: 'Avbryt' }))
    expect(onCancel).toHaveBeenCalled()
  })

  it('shows server error on failure', async () => {
    const user = userEvent.setup()
    mockUpdateTemplate.mockResolvedValue({
      success: false,
      error: 'En mall med denna slug finns redan',
    })

    render(
      <TemplateEditForm
        template={mockTemplate}
        onCancel={vi.fn()}
        onSaved={vi.fn()}
      />
    )

    await user.click(screen.getByRole('button', { name: 'Spara' }))

    await waitFor(() => {
      expect(
        screen.getByText('En mall med denna slug finns redan')
      ).toBeInTheDocument()
    })
  })
})
