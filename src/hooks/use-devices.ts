import { useCallback, useEffect, useState } from "react"
import { toast } from "sonner"
import {
  cancelDevicePairing,
  createDevice,
  createDevicePairing,
  deleteDevice,
  listDevices,
  updateDevice,
  type Device,
  type DevicePairing,
  type DeviceSettingsPatch,
} from "@/lib/api"

// How often the Devices page refreshes, so online status and a finished
// pairing show up without a reload.
const POLL_MS = 4000

function toastError(title: string, error: unknown) {
  toast.error(title, { description: error instanceof Error ? error.message : undefined })
}

// The user's devices, refreshed while mounted. Mutations return the result,
// or undefined / false on failure (already toasted).
export function useDevices() {
  const [devices, setDevices] = useState<Device[] | null>(null)

  const refresh = useCallback(async () => {
    try {
      setDevices(await listDevices())
    } catch (error) {
      toastError("Failed to load devices", error)
    }
  }, [])

  useEffect(() => {
    let stopped = false
    // Only the first load toasts a failure; later ticks retry quietly.
    const load = (first: boolean) =>
      listDevices()
        .then((list) => {
          if (!stopped) setDevices(list)
        })
        .catch((error: unknown) => {
          if (first && !stopped) toastError("Failed to load devices", error)
        })
    void load(true)
    const timer = setInterval(() => void load(false), POLL_MS)
    return () => {
      stopped = true
      clearInterval(timer)
    }
  }, [])

  const replace = (device: Device) =>
    setDevices((cur) => (cur ?? []).map((d) => (d.id === device.id ? device : d)))

  const add = useCallback(async (input: { name: string; description?: string; agent_id?: string }) => {
    try {
      const created = await createDevice(input)
      setDevices((cur) => [...(cur ?? []), created.device])
      return created
    } catch (error) {
      toastError("Failed to add the device", error)
      return undefined
    }
  }, [])

  const update = useCallback(
    async (
      id: string,
      changes: { name?: string; description?: string | null; agent_id?: string; settings?: DeviceSettingsPatch }
    ) => {
      try {
        replace(await updateDevice(id, changes))
        return true
      } catch (error) {
        toastError("Failed to save the device", error)
        return false
      }
    },
    []
  )

  const remove = useCallback(async (id: string) => {
    try {
      await deleteDevice(id)
      setDevices((cur) => (cur ?? []).filter((d) => d.id !== id))
      return true
    } catch (error) {
      toastError("Failed to delete the device", error)
      return false
    }
  }, [])

  const pair = useCallback(async (id: string): Promise<DevicePairing | undefined> => {
    try {
      const pairing = await createDevicePairing(id)
      setDevices((cur) => (cur ?? []).map((d) => (d.id === id ? { ...d, pairingExpiresAt: pairing.expiresAt } : d)))
      return pairing
    } catch (error) {
      toastError("Failed to create a pairing code", error)
      return undefined
    }
  }, [])

  const cancelPairing = useCallback(async (id: string) => {
    try {
      await cancelDevicePairing(id)
      setDevices((cur) => (cur ?? []).map((d) => (d.id === id ? { ...d, pairingExpiresAt: null } : d)))
    } catch (error) {
      toastError("Failed to cancel the pairing code", error)
    }
  }, [])

  return { devices, loading: devices === null, refresh, add, update, remove, pair, cancelPairing }
}
