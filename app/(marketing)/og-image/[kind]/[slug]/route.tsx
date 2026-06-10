import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { ImageResponse } from 'next/og'
import { notFound } from 'next/navigation'
import { getMarketingPage } from '@/lib/marketing/content'
import {
  MARKETING_KINDS,
  MARKETING_KIND_LABELS,
  type MarketingKind,
} from '@/lib/marketing/frontmatter-schemas'

/**
 * Programmatic OG image (1200×630) per marketing page (Story 26.1 AC 15).
 *
 * Landing-v3 palette: warm ink on cream, single amber accent as kind marker.
 * Safiro loaded once at module scope from public/fonts (the .woff — satori
 * does not parse .woff2); traced into the function via
 * outputFileTracingIncludes in next.config.mjs.
 */

const safiro = readFileSync(
  join(process.cwd(), 'public', 'fonts', 'safiro-medium-webfont.woff')
)

// Cream / ink / amber from the landing-v3 token set (app/globals.css).
const CREAM = 'hsl(40, 20%, 98%)'
const INK = 'hsl(30, 8%, 12%)'
const AMBER = '#d97706'

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ kind: string; slug: string }> }
) {
  const { kind, slug } = await params
  if (!(MARKETING_KINDS as readonly string[]).includes(kind)) notFound()

  const page = getMarketingPage(kind as MarketingKind, slug)
  if (!page) notFound()

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: 72,
          backgroundColor: CREAM,
          color: INK,
          fontFamily: 'Safiro',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div
            style={{
              width: 10,
              height: 10,
              borderRadius: 9999,
              backgroundColor: AMBER,
            }}
          />
          <div style={{ fontSize: 28, color: AMBER }}>
            {MARKETING_KIND_LABELS[kind as MarketingKind]}
          </div>
        </div>

        <div
          style={{
            fontSize: page.frontmatter.title.length > 45 ? 56 : 68,
            lineHeight: 1.15,
            letterSpacing: '-0.02em',
            maxWidth: 980,
          }}
        >
          {page.frontmatter.title}
        </div>

        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontSize: 30,
          }}
        >
          <div style={{ display: 'flex' }}>Laglig.se</div>
          <div style={{ display: 'flex', fontSize: 22, opacity: 0.55 }}>
            Sveriges lagar, samlade och bevakade
          </div>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
      fonts: [{ name: 'Safiro', data: safiro, weight: 500, style: 'normal' }],
      headers: {
        'Cache-Control':
          'public, max-age=86400, s-maxage=604800, stale-while-revalidate=86400',
      },
    }
  )
}
