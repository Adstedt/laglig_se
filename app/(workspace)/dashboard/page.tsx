import { getCurrentUser } from '@/lib/auth/session'

export default async function DashboardPage() {
  const user = await getCurrentUser()

  return (
    <div className="space-y-6">
      <div>
        <h1
          className="text-3xl font-bold"
          style={{ fontFamily: "'Safiro', system-ui, sans-serif" }}
        >
          Dashboard
        </h1>
        <p className="mt-2 text-muted-foreground">
          Välkommen tillbaka, {user?.name || user?.email}
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-xl border bg-card p-6">
          <h2 className="text-lg font-semibold">Profilinformation</h2>
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

        <div className="rounded-xl border bg-card p-6">
          <h2 className="text-lg font-semibold">Snabbåtgärder</h2>
          <div className="mt-4 space-y-2">
            <p className="text-sm text-muted-foreground">
              Dashboard-funktioner kommer snart...
            </p>
          </div>
        </div>

        <div className="rounded-xl border bg-card p-6">
          <h2 className="text-lg font-semibold">Senaste aktivitet</h2>
          <div className="mt-4 space-y-2">
            <p className="text-sm text-muted-foreground">
              Ingen aktivitet ännu
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
