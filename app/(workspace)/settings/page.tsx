export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1
          className="text-3xl font-bold"
          style={{ fontFamily: "'Safiro', system-ui, sans-serif" }}
        >
          Inställningar
        </h1>
        <p className="mt-2 text-muted-foreground">
          Hantera ditt konto och dina preferenser
        </p>
      </div>

      <div className="rounded-xl border bg-card p-6">
        <h2 className="text-lg font-semibold">Kontoinställningar</h2>
        <p className="mt-4 text-sm text-muted-foreground">
          Inställningssidan är under utveckling...
        </p>
      </div>
    </div>
  )
}
