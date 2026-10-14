import { useEffect, useState } from "react"
import { Bell, Eye, X } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { deleteDeviceTrigger, listDeviceTriggers, type Device, type DeviceTrigger } from "@/lib/api"

const POLL_MS = 5000

// What the device's agent set aside: reminders and watches, the soonest
// first. They come and go as the agent sets them and they fire, so the list
// refreshes while it's open. The owner can remove one.
export function DeviceTriggers({ device }: { device: Device }) {
  const [triggers, setTriggers] = useState<DeviceTrigger[] | null>(null)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    let stopped = false
    listDeviceTriggers(device.id)
      .then((list) => {
        if (!stopped) setTriggers(list)
      })
      .catch(() => {})
    const timer = setTimeout(() => setTick((t) => t + 1), POLL_MS)
    return () => {
      stopped = true
      clearTimeout(timer)
    }
  }, [device.id, tick])

  const remove = async (trigger: DeviceTrigger) => {
    try {
      await deleteDeviceTrigger(device.id, trigger.id)
      setTriggers((cur) => (cur ?? []).filter((t) => t.id !== trigger.id))
    } catch (error) {
      toast.error("Failed to remove it", { description: error instanceof Error ? error.message : undefined })
    }
  }

  if (!triggers) return null
  if (triggers.length === 0) {
    return <p className="text-xs text-muted-foreground">Nothing right now.</p>
  }
  const timeZone = device.settings.timezone ?? undefined
  return (
    <ul className="grid grid-cols-[minmax(0,1fr)] gap-2">
      {triggers.map((t) => (
        <li key={t.id} className="flex min-w-0 items-start gap-2 rounded-md border px-2.5 py-2 text-sm">
          {t.kind === "seen" ? (
            <Eye className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
          ) : (
            <Bell className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
          )}
          <div className="grid min-w-0 flex-1 gap-0.5">
            <span className="break-words">
              {t.kind === "seen"
                ? `Watching for ${t.what}${t.repeat ? ", every time" : ""}, until ${when(t.expiresAt, timeZone)}`
                : `Reminder at ${when(t.at!, timeZone)}`}
            </span>
            <span className="text-xs break-words text-muted-foreground">{t.note}</span>
          </div>
          {device.role === "owner" && (
            <Button
              variant="ghost"
              size="icon"
              className="size-6 shrink-0"
              aria-label="Remove"
              onClick={() => void remove(t)}
            >
              <X className="size-3.5" />
            </Button>
          )}
        </li>
      ))}
    </ul>
  )
}

// "18:40", or "Thu 15 Oct, 07:30" when it isn't today (in the device's time zone).
function when(iso: string, timeZone: string | undefined): string {
  const date = new Date(iso)
  const day = (d: Date) => d.toLocaleDateString("en-GB", { timeZone })
  const time = date.toLocaleTimeString("en-GB", { timeZone, hour: "2-digit", minute: "2-digit" })
  if (day(date) === day(new Date())) return time
  return `${date.toLocaleDateString("en-GB", { timeZone, weekday: "short", day: "numeric", month: "short" })}, ${time}`
}
