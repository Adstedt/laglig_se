import {
  Body,
  Container,
  Head,
  Hr,
  Html,
  Img,
  Link,
  Preview,
  Section,
  Text,
} from '@react-email/components'
import * as React from 'react'

interface LagligEmailLayoutProps {
  preview?: string
  children: React.ReactNode
  unsubscribeUrl?: string
}

// For email images, use NEXT_PUBLIC_EMAIL_ASSET_URL if set (bypass deployment protection),
// otherwise fall back to the app URL
const baseUrl =
  process.env.NEXT_PUBLIC_EMAIL_ASSET_URL ??
  process.env.NEXT_PUBLIC_APP_URL ??
  'https://laglig.se'

export function LagligEmailLayout({
  preview,
  children,
  unsubscribeUrl,
}: LagligEmailLayoutProps) {
  return (
    <Html lang="sv">
      <Head />
      {preview && <Preview>{preview}</Preview>}
      <Body style={body}>
        <Container style={container}>
          {/* Header */}
          <Section style={header}>
            <Img
              src={`${baseUrl}/images/logo-final.png`}
              width="120"
              height="32"
              alt="Laglig.se"
              style={logo}
            />
          </Section>

          {/* Body Content */}
          <Section style={content}>{children}</Section>

          <Hr style={divider} />

          {/* Footer */}
          <Section style={footer}>
            <Text style={footerText}>
              Laglig.se &mdash; Din juridiska plattform
            </Text>
            <Text style={footerCompany}>
              Laglig.se AB &bull; Stockholm, Sverige
            </Text>
            {unsubscribeUrl && (
              <Text style={footerUnsubscribe}>
                <Link href={unsubscribeUrl} style={unsubscribeLink}>
                  Avregistrera dig från e-postnotifieringar
                </Link>
              </Text>
            )}
          </Section>
        </Container>
      </Body>
    </Html>
  )
}

// Styles
const body: React.CSSProperties = {
  backgroundColor: '#f6f9fc',
  fontFamily:
    '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Ubuntu, sans-serif',
  margin: 0,
  padding: 0,
}

const container: React.CSSProperties = {
  backgroundColor: '#ffffff',
  margin: '0 auto',
  maxWidth: '600px',
  borderRadius: '8px',
  overflow: 'hidden',
}

const header: React.CSSProperties = {
  padding: '24px 32px',
  backgroundColor: '#1a1a2e',
  textAlign: 'center' as const,
}

const logo: React.CSSProperties = {
  display: 'inline-block',
  verticalAlign: 'middle',
  marginRight: '12px',
}

const divider: React.CSSProperties = {
  borderColor: '#e6ebf1',
  margin: '0 32px',
}

const content: React.CSSProperties = {
  padding: '24px 32px',
}

const footer: React.CSSProperties = {
  padding: '16px 32px 24px',
}

const footerText: React.CSSProperties = {
  fontSize: '13px',
  color: '#8898aa',
  margin: '0 0 4px',
  textAlign: 'center' as const,
}

const footerCompany: React.CSSProperties = {
  fontSize: '12px',
  color: '#aab7c4',
  margin: '0 0 8px',
  textAlign: 'center' as const,
}

const footerUnsubscribe: React.CSSProperties = {
  fontSize: '12px',
  margin: '0',
  textAlign: 'center' as const,
}

const unsubscribeLink: React.CSSProperties = {
  color: '#8898aa',
  textDecoration: 'underline',
}

export default LagligEmailLayout
