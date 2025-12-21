import { getCurrentUser } from '@/lib/auth/session'

export default async function DashboardPage() {
  const user = await getCurrentUser()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Välkommen tillbaka, {user?.name || user?.email}
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-xl border bg-card p-5">
          <h2 className="text-base font-semibold">Profilinformation</h2>
          <dl className="mt-4 space-y-2">
            <div>
              <dt className="text-sm font-medium text-muted-foreground">
                E-post
              </dt>
              <dd className="text-sm">{user?.email}</dd>
            </div>
            {user?.name && (
              <div>
                <dt className="text-sm font-medium text-muted-foreground">
                  Namn
                </dt>
                <dd className="text-sm">{user.name}</dd>
              </div>
            )}
          </dl>
        </div>

        <div className="rounded-xl border bg-card p-5">
          <h2 className="text-base font-semibold">Snabbåtgärder</h2>
          <div className="mt-3 space-y-2">
            <p className="text-sm text-muted-foreground">
              Dashboard-funktioner kommer snart...
            </p>
          </div>
        </div>

        <div className="rounded-xl border bg-card p-5">
          <h2 className="text-base font-semibold">Senaste aktivitet</h2>
          <div className="mt-3 space-y-2">
            <p className="text-sm text-muted-foreground">
              Ingen aktivitet ännu
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
