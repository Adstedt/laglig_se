import Link from 'next/link'

export default function NotFound() {
  return (
    <main className="mx-auto max-w-4xl px-4 py-16 text-center">
      <h1 className="text-4xl font-bold text-gray-900">404</h1>
      <p className="mt-4 text-lg text-gray-600">
        Lagen kunde inte hittas. Den kan ha upphävts eller flyttats.
      </p>
      <div className="mt-8">
        <Link
          href="/alla-lagar"
          className="inline-block rounded-md bg-blue-600 px-6 py-3 text-white hover:bg-blue-700"
        >
          Tillbaka till alla lagar
        </Link>
      </div>
    </main>
  )
}
