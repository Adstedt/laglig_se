'use client'

import * as React from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { Mail } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'

const menuLinks = [
  { href: '#how-it-works', label: 'Så fungerar det' },
  { href: '#pricing', label: 'Priser' },
  { href: '/om-oss', label: 'Om oss' },
  { href: '/kontakt', label: 'Kontakt' },
]

const legalLinks = [
  { href: '/integritetspolicy', label: 'Integritetspolicy' },
  { href: '/anvandarvillkor', label: 'Användarvillkor' },
  { href: '/ansvarsfriskrivning', label: 'Ansvarsfriskrivning' },
]

export function Footer() {
  const [email, setEmail] = React.useState('')

  const handleNewsletterSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    // TODO: Implement newsletter signup
    setEmail('')
  }

  return (
    <footer className="border-t bg-muted/30">
      <div className="container mx-auto px-4 py-12">
        <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-4">
          {/* Logo & Tagline */}
          <div className="space-y-4">
            <Link href="/">
              <Image
                src="/images/logo-final.png"
                alt="Laglig.se"
                width={140}
                height={54}
                className="h-8 w-auto invert dark:invert-0"
                priority
              />
            </Link>
            <p className="text-sm text-muted-foreground">
              AI-driven lagefterlevnad för svenska företag
            </p>
          </div>

          {/* Menu */}
          <div>
            <h3 className="mb-4 font-semibold">Meny</h3>
            <ul className="space-y-2">
              {menuLinks.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm text-muted-foreground hover:text-foreground"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h3 className="mb-4 font-semibold">Juridiskt</h3>
            <ul className="space-y-2">
              {legalLinks.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm text-muted-foreground hover:text-foreground"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Newsletter */}
          <div>
            <h3 className="mb-4 font-semibold">Nyhetsbrev</h3>
            <p className="mb-4 text-sm text-muted-foreground">
              Få tips om lagefterlevnad direkt i din inbox
            </p>
            <form onSubmit={handleNewsletterSubmit} className="flex gap-2">
              <Input
                type="email"
                placeholder="din@email.se"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="flex-1"
              />
              <Button type="submit" size="icon">
                <Mail className="h-4 w-4" />
                <span className="sr-only">Prenumerera</span>
              </Button>
            </form>
          </div>
        </div>

        <Separator className="my-8" />

        {/* Legal Disclaimer */}
        <div className="mb-8 rounded-lg bg-muted p-4">
          <p className="text-xs text-muted-foreground">
            <strong>Juridisk ansvarsfriskrivning:</strong> Laglig.se
            tillhandahåller AI-assisterad juridisk information. Detta är inte
            juridisk rådgivning. Kontakta en kvalificerad jurist för specifik
            vägledning.{' '}
            <Link
              href="/ansvarsfriskrivning"
              className="underline hover:text-foreground"
            >
              Läs mer
            </Link>
          </p>
        </div>

        {/* Copyright */}
        <div className="text-center text-sm text-muted-foreground">
          © {new Date().getFullYear()} Laglig.se. Alla rättigheter förbehållna.
        </div>
      </div>
    </footer>
  )
}
