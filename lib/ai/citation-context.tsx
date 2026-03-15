'use client'

import { createContext, useContext } from 'react'
import type { SourceInfo } from './citations'

const CitationSourceContext = createContext<Map<string, SourceInfo>>(new Map())

export function CitationSourceProvider({
  sourceMap,
  children,
}: {
  sourceMap: Map<string, SourceInfo>
  children: React.ReactNode
}) {
  return (
    <CitationSourceContext.Provider value={sourceMap}>
      {children}
    </CitationSourceContext.Provider>
  )
}

export function useCitationSources() {
  return useContext(CitationSourceContext)
}
