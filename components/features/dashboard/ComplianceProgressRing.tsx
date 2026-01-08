import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ListTodo } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'

interface ComplianceProgressRingProps {
  compliant: number
  total: number
}

export function ComplianceProgressRing({
  compliant,
  total,
}: ComplianceProgressRingProps) {
  // Handle edge case of no data
  if (total === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Efterlevnad</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col items-center justify-center py-8 text-muted-foreground">
          <ListTodo className="h-12 w-12 mb-4" />
          <p className="text-center font-medium">Inga listor ännu</p>
          <p className="text-center text-sm mt-1">
            Skapa din första lista för att börja spåra efterlevnad
          </p>
          <Button asChild className="mt-4">
            <Link href="/lists">Skapa lista</Link>
          </Button>
        </CardContent>
      </Card>
    )
  }

  const percentage = Math.round((compliant / total) * 100)

  // SVG circle calculations
  const size = 200
  const strokeWidth = 12
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const strokeDashoffset = circumference - (percentage / 100) * circumference

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Efterlevnad</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col items-center">
        <div className="relative" style={{ width: size, height: size }}>
          <svg
            className="transform -rotate-90"
            width={size}
            height={size}
            viewBox={`0 0 ${size} ${size}`}
          >
            {/* Background circle */}
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke="#E5E7EB"
              strokeWidth={strokeWidth}
            />
            {/* Progress circle */}
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke="#22C55E"
              strokeWidth={strokeWidth}
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              className="transition-all duration-1000 ease-out"
            />
          </svg>
          {/* Center text */}
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-4xl font-bold">{percentage}%</span>
          </div>
        </div>
        <p className="mt-4 text-sm text-muted-foreground">
          {compliant} av {total} uppfyllda
        </p>
      </CardContent>
    </Card>
  )
}
