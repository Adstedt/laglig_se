// Story 26.1: type for dynamically imported MDX modules
// (content/marketing/**/*.mdx via @next/mdx).
declare module '*.mdx' {
  import type { ComponentType } from 'react'
  const MDXContent: ComponentType<{
    components?: Record<string, ComponentType<unknown>>
  }>
  export default MDXContent
}
