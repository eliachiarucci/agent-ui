import { useEffect, useState } from "react"
import { getContextWindow, type ContextWindow } from "@/lib/api"

// Module-level cache: the window only changes when a different model is loaded,
// so one fetch per page load is enough and every ContextBar mount shares it.
let cached: ContextWindow | null = null
let pending: Promise<ContextWindow> | null = null

export function useContextWindow(): ContextWindow | null {
  const [window, setWindow] = useState<ContextWindow | null>(cached)

  useEffect(() => {
    if (cached) return
    pending ??= getContextWindow().then((value) => (cached = value))
    let cancelled = false
    pending
      .then((value) => {
        if (!cancelled) setWindow(value)
      })
      .catch(() => {
        pending = null
      })
    return () => {
      cancelled = true
    }
  }, [])

  return window
}
