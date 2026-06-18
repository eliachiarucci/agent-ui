import { useCallback, useEffect, useSyncExternalStore } from "react"
import { toast } from "sonner"
import { getUserSettings, updateDefaultModel, type ProviderType, type UserSettings } from "@/lib/api"

// Module-level store shared by every mount (Models settings, status bar): the
// account default is fetched once per page load and changes propagate instantly.
let settings: UserSettings = { defaultProvider: null, defaultModel: null }
let loaded = false
let pending: Promise<void> | null = null
const listeners = new Set<() => void>()

function emit() {
  for (const listener of listeners) listener()
}

function subscribe(fn: () => void): () => void {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

function load(): Promise<void> {
  pending ??= getUserSettings()
    .then((value) => {
      loaded = true
      settings = value
      emit()
    })
    .catch((error: unknown) => {
      pending = null
      toast.error("Failed to load settings", {
        description: error instanceof Error ? error.message : undefined,
      })
    })
  return pending
}

export function useDefaultModel() {
  const value = useSyncExternalStore(subscribe, () => settings)
  const isLoaded = useSyncExternalStore(subscribe, () => loaded)

  useEffect(() => {
    void load()
  }, [])

  // Persists the choice (null clears back to the env default). Returns false on
  // failure (already toasted).
  const set = useCallback(
    async (provider: ProviderType | null, model: string | null) => {
      try {
        settings = await updateDefaultModel(provider, model)
        emit()
        return true
      } catch (error) {
        toast.error("Failed to save default model", {
          description: error instanceof Error ? error.message : undefined,
        })
        return false
      }
    },
    []
  )

  const selected =
    value.defaultProvider && value.defaultModel
      ? { provider: value.defaultProvider, model: value.defaultModel }
      : null

  return { selected, loading: !isLoaded, set }
}
