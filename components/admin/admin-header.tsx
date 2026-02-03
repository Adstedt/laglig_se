import { Button } from '@/components/ui/button'
import { adminLogout } from '@/app/actions/admin-auth'

interface AdminHeaderProps {
  email: string
}

export function AdminHeader({ email }: AdminHeaderProps) {
  return (
    <header className="flex h-14 items-center justify-between border-b bg-white px-6">
      <span className="text-sm font-medium text-muted-foreground">
        Backoffice
      </span>
      <div className="flex items-center gap-4">
        <span className="text-sm text-gray-600">{email}</span>
        <form action={adminLogout}>
          <Button type="submit" variant="ghost" size="sm">
            Logga ut
          </Button>
        </form>
      </div>
    </header>
  )
}
