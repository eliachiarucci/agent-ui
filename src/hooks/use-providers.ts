import { useCallback, useEffect, useSyncExternalStore } from "react"
import { toast } from "sonner"
import {
  deleteProvider,
  listProviders,
  saveProvider,
  testProvider,
  type ProviderConfig,
  type ProviderSettingsInput,
  type ProviderType,
} from "@/lib/api"

// Module-level store shared by every mount (settings dialog, status-bar model
// selector, ...): saving a provider in one place is immediately visible in the
// others, and the list is fetched once per page load.
let providers: ProviderConfig[] = []
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

function setProviders(next: ProviderConfig[]) {
  providers = [...next].sort((a, b) => a.provider.localeCompare(b.provider))
  emit()
}

function load(): Promise<void> {
  pending ??= listProviders()
    .then((list) => {
      loaded = true
      setProviders(list)
    })
    .catch((error: unknown) => {
      // Allow a later mount to retry.
      pending = null
      toast.error("Failed to load providers", {
        description: error instanceof Error ? error.message : undefined,
      })
    })
  return pending
}

export function useProviders() {
  const list = useSyncExternalStore(subscribe, () => providers)
  const isLoaded = useSyncExternalStore(subscribe, () => loaded)

  useEffect(() => {
    void load()
  }, [])

  /**
   * Server-side connection check without saving. Returns the provider's model
   * list, or undefined on failure (already toasted).
   */
  const test = useCallback(
    async (provider: ProviderType, settings: ProviderSettingsInput) => {
      try {
        const { models } = await testProvider(provider, settings)
        return models
      } catch (error) {
        toast.error("Connection test failed", {
          description: error instanceof Error ? error.message : undefined,
        })
        return undefined
      }
    },
    []
  )

  /**
   * Tests then saves (the backend refuses to store settings that fail the
   * connection check). Returns false on failure (already toasted).
   */
  const save = useCallback(
    async (provider: ProviderType, settings: ProviderSettingsInput) => {
      try {
        const { provider: saved } = await saveProvider(provider, settings)
        setProviders([...providers.filter((p) => p.provider !== provider), saved])
        toast.success("Provider saved")
        return true
      } catch (error) {
        toast.error("Failed to save provider", {
          description: error instanceof Error ? error.message : undefined,
        })
        return false
      }
    },
    []
  )

  /** Removes the stored configuration. Returns false on failure (already toasted). */
  const remove = useCallback(async (provider: ProviderType) => {
    try {
      await deleteProvider(provider)
      setProviders(providers.filter((p) => p.provider !== provider))
      return true
    } catch (error) {
      toast.error("Failed to remove provider", {
        description: error instanceof Error ? error.message : undefined,
      })
      return false
    }
  }, [])

  return { providers: list, loading: !isLoaded, test, save, remove }
}
