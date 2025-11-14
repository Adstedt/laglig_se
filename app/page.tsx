export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <div className="z-10 w-full max-w-5xl items-center justify-between text-center">
        <h1 className="text-4xl font-bold mb-4">
          Welcome to <span className="text-primary-500">Laglig.se</span>
        </h1>
        <p className="text-xl mb-8">Swedish Legal Compliance SaaS Platform</p>
        <div className="flex gap-4 justify-center">
          <div className="p-4 bg-primary-50 rounded">
            <p className="text-primary-900">Primary Color</p>
          </div>
          <div className="p-4 bg-success-50 rounded">
            <p className="text-success-900">Success Color</p>
          </div>
          <div className="p-4 bg-warning-50 rounded">
            <p className="text-warning-900">Warning Color</p>
          </div>
          <div className="p-4 bg-error-50 rounded">
            <p className="text-error-900">Error Color</p>
          </div>
        </div>
      </div>
    </main>
  )
}
