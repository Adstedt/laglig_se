import Link from 'next/link'

export default function VerifyEmailPage() {
  return (
    <div className="w-full text-center">
      <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-blue-100">
        <svg
          className="h-6 w-6 text-blue-600"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
          />
        </svg>
      </div>
      <h2 className="text-2xl font-bold text-gray-900">Check your email</h2>
      <p className="mt-2 text-sm text-gray-600">
        We&apos;ve sent a verification link to your email address. Please click
        the link to activate your account.
      </p>
      <div className="mt-6 space-y-2">
        <p className="text-sm text-gray-500">
          Didn&apos;t receive an email? Check your spam folder.
        </p>
        <Link
          href="/login"
          className="block text-sm font-medium text-blue-600 hover:text-blue-500"
        >
          Return to login
        </Link>
      </div>
    </div>
  )
}
