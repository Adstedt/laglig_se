/**
 * Story 4.16: Component tests for GoogleSignInButton
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

// --- Mocks ---

const { mockSignInWithOAuth } = vi.hoisted(() => ({
  mockSignInWithOAuth: vi.fn(),
}))

vi.mock('@/lib/supabase/client', () => ({
  supabase: {
    auth: {
      signInWithOAuth: mockSignInWithOAuth,
    },
  },
}))

// --- Import after mocks ---

import { GoogleSignInButton } from '@/components/features/auth/google-signin-button'

describe('GoogleSignInButton', () => {
  const mockOnError = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    // Default: signInWithOAuth triggers redirect (no error, no return)
    mockSignInWithOAuth.mockResolvedValue({ error: null })
  })

  it('renders "Logga in med Google" when mode is login', () => {
    render(
      <GoogleSignInButton
        mode="login"
        callbackUrl="/dashboard"
        onError={mockOnError}
      />
    )
    expect(screen.getByText('Logga in med Google')).toBeDefined()
  })

  it('renders "Registrera dig med Google" when mode is signup', () => {
    render(
      <GoogleSignInButton
        mode="signup"
        callbackUrl="/onboarding"
        onError={mockOnError}
      />
    )
    expect(screen.getByText('Registrera dig med Google')).toBeDefined()
  })

  it('calls signInWithOAuth with correct redirectTo on click', async () => {
    render(
      <GoogleSignInButton
        mode="login"
        callbackUrl="/dashboard"
        onError={mockOnError}
      />
    )

    fireEvent.click(screen.getByRole('button'))

    await waitFor(() => {
      expect(mockSignInWithOAuth).toHaveBeenCalledWith({
        provider: 'google',
        options: {
          redirectTo: expect.stringContaining(
            '/auth/callback?next=%2Fdashboard'
          ),
        },
      })
    })
  })

  it('disables the button while loading', async () => {
    // Keep the promise pending to simulate loading state
    mockSignInWithOAuth.mockReturnValue(new Promise(() => {}))

    render(
      <GoogleSignInButton
        mode="login"
        callbackUrl="/dashboard"
        onError={mockOnError}
      />
    )

    const button = screen.getByRole('button')
    fireEvent.click(button)

    await waitFor(() => {
      expect(button).toBeDisabled()
    })
  })

  it('calls onError when signInWithOAuth returns an error', async () => {
    mockSignInWithOAuth.mockResolvedValue({
      error: { message: 'OAuth failed' },
    })

    render(
      <GoogleSignInButton
        mode="login"
        callbackUrl="/dashboard"
        onError={mockOnError}
      />
    )

    fireEvent.click(screen.getByRole('button'))

    await waitFor(() => {
      expect(mockOnError).toHaveBeenCalledWith(
        'Kunde inte starta Google-inloggning. Försök igen.'
      )
    })
  })

  it('re-enables button after error', async () => {
    mockSignInWithOAuth.mockResolvedValue({
      error: { message: 'OAuth failed' },
    })

    render(
      <GoogleSignInButton
        mode="login"
        callbackUrl="/dashboard"
        onError={mockOnError}
      />
    )

    const button = screen.getByRole('button')
    fireEvent.click(button)

    await waitFor(() => {
      expect(button).not.toBeDisabled()
    })
  })
})
