import { format } from 'date-fns'
import { sv } from 'date-fns/locale'
import type { ChatMessageData } from '@/app/actions/ai-chat'

/**
 * Format a conversation as readable plaintext for .txt export.
 * Strips markdown/HTML, adds timestamps and role labels.
 */
export function formatConversationAsText(messages: ChatMessageData[]): string {
  const lines: string[] = []
  lines.push('Laglig.se — Konversationsexport')
  lines.push(
    `Exporterad: ${format(new Date(), "d MMMM yyyy 'kl.' HH:mm", { locale: sv })}`
  )
  lines.push(`Antal meddelanden: ${messages.length}`)
  lines.push('─'.repeat(50))
  lines.push('')

  for (const msg of messages) {
    const timestamp = format(new Date(msg.createdAt), 'yyyy-MM-dd HH:mm', {
      locale: sv,
    })
    const role = msg.role === 'USER' ? 'Du' : 'Laglig AI'
    const content = stripMarkdown(msg.content)

    lines.push(`[${timestamp}] ${role}:`)
    lines.push(content)
    lines.push('')
  }

  return lines.join('\n')
}

/**
 * Generate the export filename in format: laglig-konversation-YYYY-MM-DD.txt
 */
export function getExportFilename(): string {
  const date = format(new Date(), 'yyyy-MM-dd')
  return `laglig-konversation-${date}.txt`
}

/**
 * Trigger a browser file download of the given text content.
 */
export function downloadTextFile(content: string, filename: string): void {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

/**
 * Strip basic markdown formatting from text.
 */
function stripMarkdown(text: string): string {
  return (
    text
      // Remove headers
      .replace(/^#{1,6}\s+/gm, '')
      // Remove bold/italic
      .replace(/\*\*(.+?)\*\*/g, '$1')
      .replace(/\*(.+?)\*/g, '$1')
      .replace(/__(.+?)__/g, '$1')
      .replace(/_(.+?)_/g, '$1')
      // Remove inline code
      .replace(/`([^`]+)`/g, '$1')
      // Remove code blocks
      .replace(/```[\s\S]*?```/g, (match) => {
        // Keep the code content, just remove the fences
        return match.replace(/```\w*\n?/g, '').trim()
      })
      // Remove links, keep text
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      // Remove images
      .replace(/!\[([^\]]*)\]\([^)]+\)/g, '$1')
      // Remove HTML tags
      .replace(/<[^>]+>/g, '')
      // Clean up citation markers
      .replace(/\[Källa:\s*[^\]]+\]/g, '')
      .trim()
  )
}
