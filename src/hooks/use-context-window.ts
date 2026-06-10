import { useEffect, useState } from "react"
import { useActiveModel } from "@/lib/active-model"
import { getContextWindow, type ContextWindow } from "@/lib/api"

// Module-level cache keyed by selection: the window only changes when a
// different model is picked (or loaded), so every mount of the same selection
// shares one fetch.
const cache = new Map<string, ContextWindow>()
const pending = new Map<string, Promise<ContextWindow>>()

export function useContextWindow(): ContextWindow | null {
  const active = useActiveModel()
  const key = active ? `${active.provider}:${active.model}` : "default"
  const [window, setWindow] = useState<ContextWindow | null>(cache.get(key) ?? null)

  useEffect(() => {
    const cached = cache.get(key)
    if (cached) {
      setWindow(cached)
      return
    }
    setWindow(null)
    let promise = pending.get(key)
    if (!promise) {
      promise = getContextWindow(active ?? undefined).then((value) => {
        cache.set(key, value)
        return value
      })
      pending.set(key, promise)
    }
    let cancelled = false
    promise
      .then((value) => {
        if (!cancelled) setWindow(value)
      })
      .catch(() => {
        pending.delete(key)
      })
    return () => {
      cancelled = true
    }
    // `key` fully encodes the selection.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  return window
}
