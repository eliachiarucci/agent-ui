import { useCallback, useEffect, useSyncExternalStore } from "react"
import { toast } from "sonner"
import {
  deleteConnector,
  listConnectors,
  saveConnector,
  setConnectorEnabled,
  type ConnectorInfo,
  type ConnectorType,
} from "@/lib/api"

// Module-level store (same shape as use-providers): the Tools tab and the
// OAuth-callback landing both see one list, fetched once per page load.
let connectors: ConnectorInfo[] = []
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

function setConnectors(next: ConnectorInfo[]) {
  connectors = next
  emit()
}

function load(): Promise<void> {
  pending ??= listConnectors()
    .then((list) => {
      loaded = true
      setConnectors(list)
    })
    .catch((error: unknown) => {
      // Allow a later mount to retry.
      pending = null
      toast.error("Failed to load connectors", {
        description: error instanceof Error ? error.message : undefined,
      })
    })
  return pending
}

export function useConnectors() {
  const list = useSyncExternalStore(subscribe, () => connectors)
  const isLoaded = useSyncExternalStore(subscribe, () => loaded)

  useEffect(() => {
    void load()
  }, [])

  /**
   * Stores the OAuth client credentials. Returns the saved entry, or undefined
   * on failure (already toasted).
   */
  const save = useCallback(
    async (connector: ConnectorType, input: { clientId: string; clientSecret?: string }) => {
      try {
        const saved = await saveConnector(connector, input)
        setConnectors(connectors.map((c) => (c.connector === connector ? saved : c)))
        toast.success("Connector saved")
        return saved
      } catch (error) {
        toast.error("Failed to save connector", {
          description: error instanceof Error ? error.message : undefined,
        })
        return undefined
      }
    },
    []
  )

  /**
   * The card's on/off switch. Optimistic — the switch flips immediately and
   * rolls back if the request fails (already toasted).
   */
  const toggle = useCallback(async (connector: ConnectorType, enabled: boolean) => {
    const previous = connectors
    setConnectors(connectors.map((c) => (c.connector === connector ? { ...c, enabled } : c)))
    try {
      const saved = await setConnectorEnabled(connector, enabled)
      setConnectors(connectors.map((c) => (c.connector === connector ? saved : c)))
    } catch (error) {
      setConnectors(previous)
      toast.error(enabled ? "Failed to enable connector" : "Failed to disable connector", {
        description: error instanceof Error ? error.message : undefined,
      })
    }
  }, [])

  /** Disconnects and forgets the credentials. Returns false on failure (already toasted). */
  const remove = useCallback(async (connector: ConnectorType) => {
    try {
      await deleteConnector(connector)
      // The catalog entry stays (it always lists every connector); refetch for
      // its reset state.
      pending = null
      await load()
      toast.success("Connector removed")
      return true
    } catch (error) {
      toast.error("Failed to remove connector", {
        description: error instanceof Error ? error.message : undefined,
      })
      return false
    }
  }, [])

  return { connectors: list, loading: !isLoaded, save, toggle, remove }
}
