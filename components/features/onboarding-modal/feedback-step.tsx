'use client'

/**
 * Story 25.5 (Epic 25, B.5): Product-feedback form rendered as the 7th tab
 * in the tutorial-tabs strip.
 *
 * **Scope (product-wide, not modal-specific).** The form captures general
 * product feedback that just *happens to live in the onboarding modal* as
 * its first surface. Future stories may surface the same form (or a deep-
 * link) from settings, the dashboard footer, or a Hjälp-menu link — all
 * routing through `submitProductFeedback` with a different `source` value.
 *
 * Layout: 5-col grid (LEFT col-span-2 form, RIGHT col-span-3 context card)
 * matching the rest of the tutorial-tab panels (`tab-laglista.tsx:27` uses
 * the identical container class). On submit success, the LEFT column flips
 * to a confirmation state while the RIGHT card stays mounted.
 */

import { useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import { CheckCircle2, Loader2, ThumbsDown, ThumbsUp } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { submitProductFeedback } from '@/app/actions/onboarding-modal'
import { cn } from '@/lib/utils'

type Sentiment = 'positive' | 'negative'
type Status = 'idle' | 'submitting' | 'submitted'

export function FeedbackStep() {
  const [sentiment, setSentiment] = useState<Sentiment | null>(null)
  const [message, setMessage] = useState('')
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<Status>('idle')

  // Roving-tabindex refs for the sentiment radiogroup. Mirrors the tab-bar
  // pattern at tutorial-step.tsx:90-112 — only one button is Tab-reachable
  // at a time; ArrowLeft/Right cycles + moves focus.
  const positiveRef = useRef<HTMLButtonElement | null>(null)
  const negativeRef = useRef<HTMLButtonElement | null>(null)

  function selectSentiment(next: Sentiment) {
    if (sentiment === next) return
    setSentiment(next)
  }

  function handleSentimentKeyDown(e: KeyboardEvent<HTMLButtonElement>) {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
    e.preventDefault()
    const next: Sentiment = sentiment === 'positive' ? 'negative' : 'positive'
    selectSentiment(next)
    requestAnimationFrame(() => {
      const ref = next === 'positive' ? positiveRef : negativeRef
      ref.current?.focus()
    })
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (sentiment === null || status === 'submitting') return

    setStatus('submitting')

    const trimmedMessage = message.trim()
    const trimmedEmail = email.trim()

    const result = await submitProductFeedback({
      sentiment,
      ...(trimmedMessage.length > 0 && { message: trimmedMessage }),
      ...(trimmedEmail.length > 0 && { email: trimmedEmail }),
    })

    if (result.ok) {
      setStatus('submitted')
    } else {
      setStatus('idle')
      toast.error(result.error)
    }
  }

  function resetForm() {
    setSentiment(null)
    setMessage('')
    setEmail('')
    setStatus('idle')
  }

  // Roving tabindex: focus lands on the selected button, or the positive
  // button by default if none selected. AC 26.
  const positiveTabIndex =
    sentiment === null || sentiment === 'positive' ? 0 : -1
  const negativeTabIndex = sentiment === 'negative' ? 0 : -1

  return (
    <div className="grid grid-cols-5 gap-8 px-1 pt-2 pb-2">
      {/* LEFT: form OR confirmation */}
      <div className="col-span-2">
        {status === 'submitted' ? (
          <>
            <CheckCircle2
              className="mb-4 h-10 w-10 text-foreground/70"
              aria-hidden="true"
            />
            <h3 className="font-safiro mb-3 text-[22px] leading-snug tracking-tight">
              Tack — vi läser allt.
            </h3>
            <p className="mb-5 text-[13.5px] leading-relaxed text-muted-foreground">
              Vi tar med oss det här i nästa runda förbättringar. Vill du säga
              något mer?
            </p>
            <button
              type="button"
              onClick={resetForm}
              className="text-[13px] text-foreground underline-offset-4 hover:underline"
            >
              Skicka en till →
            </button>
          </>
        ) : (
          <>
            <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              Feedback
            </div>
            <h3 className="font-safiro mb-3 text-[22px] leading-snug tracking-tight">
              Vad tycker du om Laglig.se?
            </h3>
            <p className="mb-5 text-[13.5px] leading-relaxed text-muted-foreground">
              Det här går direkt till teamet. Allt är välkommet — vad som
              fungerar, vad som saknas, en bugg du sett, eller en idé. En tumme
              räcker, men en mening hjälper mer.
            </p>

            <form onSubmit={handleSubmit}>
              {/* Sentiment radiogroup */}
              <div
                role="radiogroup"
                aria-label="Övergripande intryck"
                aria-required="true"
                className="mb-5 flex gap-2"
              >
                <button
                  ref={positiveRef}
                  type="button"
                  role="radio"
                  aria-checked={sentiment === 'positive'}
                  aria-label="Bra"
                  tabIndex={positiveTabIndex}
                  onClick={() => selectSentiment('positive')}
                  onKeyDown={handleSentimentKeyDown}
                  className={cn(
                    'inline-flex h-10 w-10 items-center justify-center rounded-md border transition-colors',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                    sentiment === 'positive'
                      ? 'border-foreground bg-foreground/5 text-foreground'
                      : 'border-input bg-transparent text-muted-foreground hover:bg-accent hover:text-foreground'
                  )}
                >
                  <ThumbsUp className="h-5 w-5" aria-hidden="true" />
                </button>
                <button
                  ref={negativeRef}
                  type="button"
                  role="radio"
                  aria-checked={sentiment === 'negative'}
                  aria-label="Dåligt"
                  tabIndex={negativeTabIndex}
                  onClick={() => selectSentiment('negative')}
                  onKeyDown={handleSentimentKeyDown}
                  className={cn(
                    'inline-flex h-10 w-10 items-center justify-center rounded-md border transition-colors',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                    sentiment === 'negative'
                      ? 'border-foreground bg-foreground/5 text-foreground'
                      : 'border-input bg-transparent text-muted-foreground hover:bg-accent hover:text-foreground'
                  )}
                >
                  <ThumbsDown className="h-5 w-5" aria-hidden="true" />
                </button>
              </div>

              {/* Message textarea */}
              <div className="mb-4">
                <Textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value.slice(0, 500))}
                  maxLength={500}
                  rows={4}
                  placeholder="Vad fungerar bra eller dåligt? Vad saknas?"
                  aria-label="Meddelande (valfritt)"
                  className="resize-none"
                />
              </div>

              {/* Email field */}
              <div className="mb-5">
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Din e-post (valfritt — vi använder din inloggning som standard)"
                  aria-label="Reply-to e-post (valfritt)"
                  autoComplete="email"
                  inputMode="email"
                />
              </div>

              {/* Submit row */}
              <div className="flex items-center justify-between">
                {message.length > 0 ? (
                  <span className="text-[12.5px] text-muted-foreground">
                    {message.length} / 500
                  </span>
                ) : (
                  <span />
                )}
                <Button
                  type="submit"
                  disabled={sentiment === null || status === 'submitting'}
                >
                  {status === 'submitting' ? (
                    <>
                      <Loader2
                        className="mr-1.5 h-3.5 w-3.5 animate-spin"
                        aria-hidden="true"
                      />
                      Skickar...
                    </>
                  ) : (
                    'Skicka feedback'
                  )}
                </Button>
              </div>
            </form>
          </>
        )}
      </div>

      {/* RIGHT: context card (stays mounted across form ↔ confirmation).
          mt-12 (48px) aligns the card's top with the LEFT subheadline
          baseline — the calculated eyebrow+headline height was ~70px but
          rendered browser metrics put the visual baseline ~one line higher.
          Optimised for the form state; the confirmation state (icon h-10 +
          mb-4 + h3) is taller so alignment is briefly off during the "Tack"
          moment — acceptable since the form is the primary state. */}
      <div className="col-span-3 mt-12">
        <div className="rounded-lg bg-section-warm/60 p-5 text-[13px] text-muted-foreground">
          <p className="mb-3">
            Vi får ett mejl direkt — ingen formulär-pipa till en helpdesk eller
            ett ticketing-system. En person läser, och om du har lämnat en
            e-post hör vi av oss om det behövs.
          </p>
          <p>
            Vi sparar din e-post, ditt meddelande, och att det skickades från
            onboarding-guiden. Inga session-IDs, ingen analytik. Du kan begära
            att vi raderar inlägget när som helst.
          </p>
        </div>
      </div>
    </div>
  )
}
