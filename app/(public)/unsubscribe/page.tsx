import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Avregistrera e-post — Laglig.se',
  robots: { index: false, follow: false },
}

async function unsubscribe(token: string): Promise<boolean> {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

  try {
    const res = await fetch(`${baseUrl}/api/email/unsubscribe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    })
    const data = (await res.json()) as { success: boolean }
    return data.success
  } catch {
    return false
  }
}

export default async function UnsubscribePage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>
}) {
  const { token } = await searchParams
  const success = token ? await unsubscribe(token) : false

  return (
    <main
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", sans-serif',
        backgroundColor: '#f6f9fc',
        padding: '24px',
      }}
    >
      <div
        style={{
          maxWidth: '480px',
          backgroundColor: '#ffffff',
          borderRadius: '8px',
          padding: '48px 32px',
          textAlign: 'center',
          boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
        }}
      >
        {success ? (
          <>
            <h1
              style={{
                fontSize: '24px',
                marginBottom: '16px',
                color: '#1a1a2e',
              }}
            >
              Avregistrerad
            </h1>
            <p style={{ fontSize: '16px', color: '#525f7f', lineHeight: 1.6 }}>
              Du har avregistrerat dig fran e-postnotifieringar for denna
              arbetsyta.
            </p>
          </>
        ) : (
          <>
            <h1
              style={{
                fontSize: '24px',
                marginBottom: '16px',
                color: '#1a1a2e',
              }}
            >
              Nagot gick fel
            </h1>
            <p style={{ fontSize: '16px', color: '#525f7f', lineHeight: 1.6 }}>
              Ogiltig eller utgangen lank. Kontakta{' '}
              <a href="mailto:support@laglig.se" style={{ color: '#3b82f6' }}>
                support@laglig.se
              </a>
              .
            </p>
          </>
        )}
      </div>
    </main>
  )
}
