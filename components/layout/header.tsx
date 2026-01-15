'use client'

import Link from 'next/link'
import Image from 'next/image'
import { Search, Bell, Menu } from 'lucide-react'
import { UserMenu } from '@/components/layout/user-menu'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

interface HeaderProps {
  user: {
    name?: string | null
    email?: string | null
    image?: string | null
  }
  onMenuToggle?: () => void
}

export function Header({ user, onMenuToggle }: HeaderProps) {
  return (
    <header className="sticky top-0 z-50 flex h-[60px] shrink-0 items-center border-b bg-background">
      {/* Logo section - fixed width to align with sidebar, hidden on mobile */}
      <div className="hidden md:flex h-full w-[240px] items-center px-4">
        <Link href="/dashboard">
          <Image
            src="/images/logo.png"
            alt="Laglig.se"
            width={180}
            height={45}
            className="h-11 w-auto invert dark:invert-0"
            priority
          />
        </Link>
      </div>

      {/* Main header content */}
      <div className="flex flex-1 items-center gap-4 px-4 h-full">
        {/* Mobile menu toggle */}
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden"
          onClick={onMenuToggle}
        >
          <Menu className="h-5 w-5" />
          <span className="sr-only">Meny</span>
        </Button>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Global Search Placeholder */}
        <div className="relative hidden w-72 lg:block">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Sök lagar, rättsfall..."
            className="h-9 pl-9 bg-muted/50 border-0 focus-visible:bg-background focus-visible:ring-1"
            disabled
            title="Sökning kommer snart"
          />
        </div>

        {/* Notification Bell Placeholder */}
        <Button
          variant="ghost"
          size="icon"
          className="relative h-9 w-9"
          disabled
          title="Notifieringar kommer snart"
        >
          <Bell className="h-5 w-5 text-muted-foreground" />
          <span className="sr-only">Notifieringar</span>
        </Button>

        {/* User Menu */}
        <UserMenu user={user} />
      </div>
    </header>
  )
}
