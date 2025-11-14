import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Laglig.se',
  description: 'Swedish Legal Compliance SaaS Platform',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="sv">
      <body>{children}</body>
    </html>
  )
}
