import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'

import { TabKravpunkter } from '@/components/features/onboarding-modal/tutorial-tabs/tab-kravpunkter'

describe('<TabKravpunkter>', () => {
  it('renders the eyebrow + h3 heading', () => {
    render(<TabKravpunkter />)
    expect(screen.getByText('Bevisföring')).toBeInTheDocument()
    expect(
      screen.getByRole('heading', {
        level: 3,
        name: 'Vad lagen kräver — bit för bit',
      })
    ).toBeInTheDocument()
  })

  it('renders the kravpunkter checklist preview', () => {
    render(<TabKravpunkter />)
    expect(
      screen.getByText('Förhandsvisning · Miljöbalk → kravpunkter')
    ).toBeInTheDocument()
    expect(
      screen.getByText(/Saknar bevis — be ansvarig ladda upp/)
    ).toBeInTheDocument()
  })
})
