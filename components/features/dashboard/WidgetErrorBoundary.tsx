'use client'

import { Component, type ReactNode } from 'react'
import { AlertCircle } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

interface WidgetErrorBoundaryProps {
  children: ReactNode
  widgetName: string
  fallback?: ReactNode
}

interface WidgetErrorBoundaryState {
  hasError: boolean
}

export class WidgetErrorBoundary extends Component<
  WidgetErrorBoundaryProps,
  WidgetErrorBoundaryState
> {
  constructor(props: WidgetErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(): WidgetErrorBoundaryState {
    return { hasError: true }
  }

  handleRetry = () => {
    this.setState({ hasError: false })
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback
      }

      return (
        <Card className="border-destructive/50">
          <CardContent className="flex flex-col items-center justify-center py-8 text-muted-foreground">
            <AlertCircle className="h-8 w-8 mb-2" />
            <p>Kunde inte ladda {this.props.widgetName}</p>
            <Button
              variant="ghost"
              size="sm"
              onClick={this.handleRetry}
              className="mt-2"
            >
              Försök igen
            </Button>
          </CardContent>
        </Card>
      )
    }

    return this.props.children
  }
}
