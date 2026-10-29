"use client"
import { createContext, useContext } from "react"

export type CitationContextType = {
  map: Map<string, string>
  nextLabel: string
}

export const CitationContext = createContext<CitationContextType>({
  map: new Map(),
  nextLabel: "1",
})

export function useCitationContext() {
  return useContext(CitationContext)
}
