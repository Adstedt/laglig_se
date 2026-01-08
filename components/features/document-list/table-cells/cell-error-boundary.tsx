'use client'

/**
 * Story 6.2: CellErrorBoundary for Table View
 * Lightweight error boundary for table cells that prevents entire row from breaking
 */

import { Component, type ReactNode } from 'react'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { AlertCircle } from 'lucide-react'

interface CellErrorBoundaryProps {
  children: ReactNode
  fallback?: ReactNode
}

interface CellErrorBoundaryState {
  hasError: boolean
  error?: Error
}

export class CellErrorBoundary extends Component<
  CellErrorBoundaryProps,
  CellErrorBoundaryState
> {
  constructor(props: CellErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: Error): CellErrorBoundaryState {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('CellErrorBoundary caught error:', error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback ?? (
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="inline-flex items-center text-muted-foreground cursor-help">
                <AlertCircle className="h-4 w-4 mr-1 text-destructive" />
                <span>—</span>
              </span>
            </TooltipTrigger>
            <TooltipContent>
              <p>Kunde inte ladda data</p>
            </TooltipContent>
          </Tooltip>
        )
      )
    }

    return this.props.children
  }
}
