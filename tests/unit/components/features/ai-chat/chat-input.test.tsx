import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ChatInput } from '@/components/features/ai-chat/chat-input'

describe('ChatInput', () => {
  const mockOnSend = vi.fn()

  beforeEach(() => {
    mockOnSend.mockClear()
  })

  it('renders input with placeholder', () => {
    render(<ChatInput onSend={mockOnSend} />)
    expect(
      screen.getByPlaceholderText('Skriv din fråga...')
    ).toBeInTheDocument()
  })

  it('renders custom placeholder', () => {
    render(<ChatInput onSend={mockOnSend} placeholder="Custom placeholder" />)
    expect(
      screen.getByPlaceholderText('Custom placeholder')
    ).toBeInTheDocument()
  })

  it('disables send button when input is empty', () => {
    render(<ChatInput onSend={mockOnSend} />)
    const sendButton = screen.getByRole('button', { name: /skicka/i })
    expect(sendButton).toBeDisabled()
  })

  it('enables send button when input has content', async () => {
    const user = userEvent.setup()
    render(<ChatInput onSend={mockOnSend} />)

    const input = screen.getByTestId('chat-input')
    await user.type(input, 'Test message')

    const sendButton = screen.getByRole('button', { name: /skicka/i })
    expect(sendButton).toBeEnabled()
  })

  it('calls onSend when send button is clicked', async () => {
    const user = userEvent.setup()
    render(<ChatInput onSend={mockOnSend} />)

    const input = screen.getByTestId('chat-input')
    await user.type(input, 'Test message')
    await user.click(screen.getByRole('button', { name: /skicka/i }))

    expect(mockOnSend).toHaveBeenCalledWith('Test message')
  })

  it('calls onSend when Enter is pressed', async () => {
    const user = userEvent.setup()
    render(<ChatInput onSend={mockOnSend} />)

    const input = screen.getByTestId('chat-input')
    await user.type(input, 'Test message{Enter}')

    expect(mockOnSend).toHaveBeenCalledWith('Test message')
  })

  it('does not call onSend when Shift+Enter is pressed', async () => {
    const user = userEvent.setup()
    render(<ChatInput onSend={mockOnSend} />)

    const input = screen.getByTestId('chat-input')
    await user.type(input, 'Test message{Shift>}{Enter}{/Shift}')

    expect(mockOnSend).not.toHaveBeenCalled()
  })

  it('shows character counter when above threshold', () => {
    render(<ChatInput onSend={mockOnSend} />)

    const input = screen.getByTestId('chat-input')
    // Use fireEvent for bulk text entry (1501 characters above 1500 threshold)
    fireEvent.change(input, { target: { value: 'a'.repeat(1501) } })

    expect(screen.getByText(/1501\/2000/)).toBeInTheDocument()
  })

  it('disables input when disabled prop is true', () => {
    render(<ChatInput onSend={mockOnSend} disabled />)
    expect(screen.getByTestId('chat-input')).toBeDisabled()
  })

  it('shows loading state when isLoading is true', () => {
    render(<ChatInput onSend={mockOnSend} isLoading />)
    expect(screen.getByTestId('chat-input')).toBeDisabled()
  })

  it('displays Swedish help text', () => {
    render(<ChatInput onSend={mockOnSend} />)
    expect(screen.getByText('Tryck Enter för att skicka')).toBeInTheDocument()
  })
})
