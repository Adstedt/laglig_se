import {
  Body,
  Button,
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

/* -------------------------------------------------------------------------- */
/* Design tokens — matches emails/supabase templates/*.html                   */
/* -------------------------------------------------------------------------- */

const colors = {
  canvas: '#f5f3ee',
  card: '#ffffff',
  ink: '#1c1a17',
  inkSoft: '#7a7470',
  inkMuted: '#a09a94',
  inkFaint: '#bdb8b2',
  divider: '#e8e5e0',
  ctaBg: '#231f1a',
  ctaText: '#faf9f7',
  accentBg: '#f2efe8',
  warnBg: '#fef6ec',
  warnText: '#b45309',
  dangerBg: '#231f1a',
} as const

const fontFamily =
  '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'

/* -------------------------------------------------------------------------- */
/* Layout                                                                     */
/* -------------------------------------------------------------------------- */

const baseUrl =
  process.env.NEXT_PUBLIC_EMAIL_ASSET_URL ??
  process.env.NEXT_PUBLIC_APP_URL ??
  'https://laglig.se'

interface LagligEmailLayoutProps {
  preview?: string
  children: React.ReactNode
  unsubscribeUrl?: string
}

export function LagligEmailLayout({
  preview,
  children,
  unsubscribeUrl,
}: LagligEmailLayoutProps) {
  return (
    <Html lang="sv">
      <Head>
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
        `}</style>
      </Head>
      {preview && <Preview>{preview}</Preview>}
      <Body style={body}>
        <Container style={container}>
          {/* Logo */}
          <Section style={logoWrap}>
            <Img
              src={`${baseUrl}/images/logo-final.png`}
              width="140"
              alt="Laglig.se"
              style={logo}
            />
          </Section>

          {/* Card */}
          <Section style={card}>
            {/* Top accent line */}
            <div style={accentLine} />
            <div style={cardBody}>{children}</div>
          </Section>

          {/* Footer */}
          <Section style={footer}>
            <Text style={footerText}>Laglig.se &mdash; Coolt med koll.</Text>
            <Text style={footerCompany}>Stockholm, Sverige</Text>
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

/* -------------------------------------------------------------------------- */
/* Shared primitives                                                          */
/* -------------------------------------------------------------------------- */

export function EmailIconCircle({
  src,
  tone = 'neutral',
}: {
  src: string
  tone?: 'neutral' | 'warning'
}) {
  const bg = tone === 'warning' ? colors.warnBg : colors.accentBg
  return (
    <Section style={{ textAlign: 'center', padding: '0 0 20px 0' }}>
      <table
        role="presentation"
        cellSpacing={0}
        cellPadding={0}
        border={0}
        align="center"
        style={{ margin: '0 auto' }}
      >
        <tbody>
          <tr>
            <td
              style={{
                width: '56px',
                height: '56px',
                backgroundColor: bg,
                borderRadius: '50%',
                textAlign: 'center',
                verticalAlign: 'middle',
              }}
            >
              <Img
                src={src}
                width="24"
                height="24"
                alt=""
                style={{ display: 'inline-block', verticalAlign: 'middle' }}
              />
            </td>
          </tr>
        </tbody>
      </table>
    </Section>
  )
}

export function EmailHeading({
  children,
  align = 'center',
}: {
  children: React.ReactNode
  align?: 'center' | 'left'
}) {
  return <Text style={{ ...heading, textAlign: align }}>{children}</Text>
}

export function EmailBody({
  children,
  align = 'center',
}: {
  children: React.ReactNode
  align?: 'center' | 'left'
}) {
  return <Text style={{ ...bodyText, textAlign: align }}>{children}</Text>
}

export function EmailMeta({
  children,
  align = 'center',
}: {
  children: React.ReactNode
  align?: 'center' | 'left'
}) {
  return <Text style={{ ...metaText, textAlign: align }}>{children}</Text>
}

export function EmailCta({
  href,
  children,
  variant = 'primary',
}: {
  href: string
  children: React.ReactNode
  variant?: 'primary' | 'danger'
}) {
  return (
    <Section style={{ textAlign: 'center', padding: '28px 0 0 0' }}>
      <Button
        href={href}
        style={{
          ...ctaButton,
          backgroundColor:
            variant === 'danger' ? colors.dangerBg : colors.ctaBg,
        }}
      >
        {children}
      </Button>
    </Section>
  )
}

export function EmailDivider() {
  return <Hr style={divider} />
}

export function EmailBadge({
  children,
  tone = 'neutral',
}: {
  children: React.ReactNode
  tone?: 'neutral' | 'warning' | 'danger'
}) {
  const palette = {
    neutral: { bg: colors.accentBg, fg: colors.ink },
    warning: { bg: colors.warnBg, fg: colors.warnText },
    danger: { bg: '#fbeaea', fg: '#991b1b' },
  }[tone]
  return (
    <span
      style={{
        display: 'inline-block',
        backgroundColor: palette.bg,
        color: palette.fg,
        padding: '3px 10px',
        borderRadius: '999px',
        fontSize: '12px',
        fontWeight: 600,
        letterSpacing: '0.2px',
      }}
    >
      {children}
    </span>
  )
}

export function EmailInfoCard({ children }: { children: React.ReactNode }) {
  return <Section style={infoCard}>{children}</Section>
}

export function EmailFallbackLink({ url }: { url: string }) {
  return (
    <Section style={{ textAlign: 'center', padding: '20px 0 0 0' }}>
      <Text style={metaText}>
        Fungerar inte knappen? Kopiera och klistra in denna länk i din
        webbläsare:
      </Text>
      <Text
        style={{
          ...metaText,
          fontSize: '12px',
          margin: '6px 0 0 0',
          wordBreak: 'break-all',
        }}
      >
        <Link href={url} style={fallbackLinkStyle}>
          {url}
        </Link>
      </Text>
    </Section>
  )
}

export function EmailSecurityNote({ children }: { children: React.ReactNode }) {
  return (
    <>
      <EmailDivider />
      <Section style={{ textAlign: 'center', padding: '20px 0 0 0' }}>
        <Text style={metaText}>{children}</Text>
      </Section>
    </>
  )
}

/* -------------------------------------------------------------------------- */
/* Styles                                                                     */
/* -------------------------------------------------------------------------- */

const body: React.CSSProperties = {
  backgroundColor: colors.canvas,
  fontFamily,
  margin: 0,
  padding: '40px 16px',
  width: '100%',
}

const container: React.CSSProperties = {
  margin: '0 auto',
  maxWidth: '520px',
  width: '100%',
}

const logoWrap: React.CSSProperties = {
  padding: '0 0 32px 0',
  textAlign: 'center' as const,
}

const logo: React.CSSProperties = {
  display: 'inline-block',
  height: 'auto',
  filter: 'invert(1)',
}

const card: React.CSSProperties = {
  backgroundColor: colors.card,
  borderRadius: '12px',
  boxShadow:
    '0 1px 3px rgba(28, 26, 23, 0.06), 0 8px 24px rgba(28, 26, 23, 0.04)',
  overflow: 'hidden',
  padding: 0,
}

const accentLine: React.CSSProperties = {
  height: '3px',
  background: 'linear-gradient(90deg, #231f1a 0%, #3d362e 50%, #231f1a 100%)',
  lineHeight: 0,
  fontSize: 0,
}

const cardBody: React.CSSProperties = {
  padding: '40px 40px 36px 40px',
}

const heading: React.CSSProperties = {
  fontSize: '24px',
  fontWeight: 700,
  color: colors.ink,
  letterSpacing: '-0.3px',
  lineHeight: 1.3,
  margin: '0 0 12px 0',
}

const bodyText: React.CSSProperties = {
  fontSize: '15px',
  lineHeight: 1.6,
  color: colors.inkSoft,
  margin: '0 0 0 0',
}

const metaText: React.CSSProperties = {
  fontSize: '13px',
  lineHeight: 1.5,
  color: colors.inkMuted,
  margin: 0,
}

const ctaButton: React.CSSProperties = {
  backgroundColor: colors.ctaBg,
  color: colors.ctaText,
  fontSize: '15px',
  fontWeight: 600,
  padding: '14px 36px',
  borderRadius: '8px',
  textDecoration: 'none',
  letterSpacing: '0.2px',
  display: 'inline-block',
}

const divider: React.CSSProperties = {
  borderColor: colors.divider,
  borderTop: `1px solid ${colors.divider}`,
  margin: '32px 0 0 0',
}

const infoCard: React.CSSProperties = {
  backgroundColor: '#faf8f3',
  border: `1px solid ${colors.divider}`,
  borderRadius: '10px',
  padding: '18px 20px',
  margin: '20px 0 0 0',
}

const fallbackLinkStyle: React.CSSProperties = {
  color: colors.inkSoft,
  textDecoration: 'underline',
}

const footer: React.CSSProperties = {
  padding: '28px 16px 0 16px',
  textAlign: 'center' as const,
}

const footerText: React.CSSProperties = {
  fontSize: '12px',
  lineHeight: 1.5,
  color: colors.inkMuted,
  margin: 0,
}

const footerCompany: React.CSSProperties = {
  fontSize: '12px',
  lineHeight: 1.5,
  color: colors.inkFaint,
  margin: '6px 0 0 0',
}

const footerUnsubscribe: React.CSSProperties = {
  fontSize: '12px',
  margin: '12px 0 0 0',
}

const unsubscribeLink: React.CSSProperties = {
  color: colors.inkMuted,
  textDecoration: 'underline',
}

export { colors as emailColors }
export default LagligEmailLayout
