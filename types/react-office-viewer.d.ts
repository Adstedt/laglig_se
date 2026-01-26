/**
 * Type declarations for react-office-viewer
 * Library doesn't provide its own types
 */

declare module 'react-office-viewer' {
  import { ComponentType } from 'react'

  interface ViewerProps {
    fileName: string
    url: string
    width?: string | number
    height?: number
    locale?: string
    onLoad?: () => void
    onError?: (_error: Error | null) => void
  }

  const Viewer: ComponentType<ViewerProps>
  export default Viewer
}
