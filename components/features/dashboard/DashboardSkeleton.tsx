import { Skeleton } from '@/components/ui/skeleton'

export function DashboardSkeleton() {
  return (
    <div className="-m-4 md:-m-6 flex flex-col h-[calc(100vh-60px)] items-center justify-center px-4">
      <div className="w-full max-w-2xl space-y-6">
        {/* Logo placeholder */}
        <div className="flex justify-center">
          <Skeleton className="h-12 w-10 rounded-lg" />
        </div>

        {/* Greeting */}
        <div className="flex justify-center">
          <Skeleton className="h-9 w-72" />
        </div>

        {/* Context cards */}
        <div className="flex justify-center gap-3">
          <Skeleton className="h-20 w-36 rounded-xl" />
          <Skeleton className="h-20 w-36 rounded-xl" />
          <Skeleton className="h-20 w-36 rounded-xl" />
        </div>

        {/* Input */}
        <Skeleton className="h-14 w-full rounded-xl" />

        {/* Suggested prompts */}
        <div className="flex justify-center gap-2">
          <Skeleton className="h-9 w-48 rounded-full" />
          <Skeleton className="h-9 w-40 rounded-full" />
          <Skeleton className="h-9 w-44 rounded-full" />
        </div>
      </div>
    </div>
  )
}
