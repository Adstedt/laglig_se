import { vi, describe, beforeEach, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('next/link', () => ({
  default: ({
    children,
    href,
    ...props
  }: {
    children: React.ReactNode
    href: string
    className?: string
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}))

import { TemplateAdoptCta } from '@/components/features/templates/template-adopt-cta'

describe('TemplateAdoptCta', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders "Använd denna mall" button', () => {
    render(<TemplateAdoptCta templateName="Arbetsmiljö" />)

    expect(screen.getByText('Använd denna mall')).toBeInTheDocument()
  })

  it('button is currently disabled (pre-12.10)', () => {
    render(<TemplateAdoptCta templateName="Arbetsmiljö" />)

    const button = screen.getByRole('button', { name: /Använd denna mall/ })
    expect(button).toBeDisabled()
  })

  it('shows "Malladoption lanseras snart" inline note', () => {
    render(<TemplateAdoptCta templateName="Arbetsmiljö" />)

    expect(screen.getByText(/Malladoption lanseras snart/)).toBeInTheDocument()
  })

  it('renders template name', () => {
    render(<TemplateAdoptCta templateName="Arbetsmiljö" />)

    expect(screen.getByText('Arbetsmiljö')).toBeInTheDocument()
  })
})
