import { useState } from "react"
import { ChevronDown, Cpu, Loader2, Plus } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { DeviceDetails } from "@/components/device-details"
import { DevicePairingPanel } from "@/components/device-pairing"
import { useDevices } from "@/hooks/use-devices"
import type { Agent, Device, DevicePairing } from "@/lib/api"
import { timeAgo } from "@/lib/devices"
import { cn } from "@/lib/utils"

const NEW_AGENT = "new"

// Settings → Devices: cameras, speakers and microphones the agents work
// through. Adding one shows a one-time pairing code to type on the device,
// which trades it for its own key; then its jobs, their models and its tools
// are set here.
export function DevicesSettings({
  agents,
  onAgentsChanged,
}: {
  agents: Agent[]
  // Adding a device without an agent creates one; the agent lists reload.
  onAgentsChanged: () => void
}) {
  const { devices, loading, add, update, remove, pair, cancelPairing } = useDevices()
  const [expanded, setExpanded] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  // Codes shown this session, by device (the server keeps only their hashes),
  // and where: on top of a device just added, in place of "Pair again" otherwise.
  const [pairings, setPairings] = useState<Record<string, { pairing: DevicePairing; top: boolean }>>({})

  const showPairing = (id: string, pairing: DevicePairing, top: boolean) => {
    setPairings((cur) => ({ ...cur, [id]: { pairing, top } }))
    setExpanded(id)
  }
  const hidePairing = (id: string) =>
    setPairings((cur) => Object.fromEntries(Object.entries(cur).filter(([key]) => key !== id)))

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-4">
      <p className="text-sm text-muted-foreground">
        Devices are cameras, speakers and microphones an agent works through. Add one here, then
        pair it with the code shown. Each device has its own models and tools.
      </p>

      {adding ? (
        <AddDeviceForm
          agents={agents}
          onCancel={() => setAdding(false)}
          onAdd={async (input) => {
            const created = await add(input)
            if (!created) return
            if (!input.agent_id) onAgentsChanged()
            setAdding(false)
            showPairing(created.device.id, created.pairing, true)
          }}
        />
      ) : (
        <Button variant="outline" className="justify-self-start gap-2" onClick={() => setAdding(true)}>
          <Plus className="size-4" />
          Add device
        </Button>
      )}

      {loading ? (
        <Skeleton className="h-16 w-full" />
      ) : devices && devices.length === 0 && !adding ? (
        <p className="text-sm text-muted-foreground">No devices yet.</p>
      ) : (
        devices?.map((device) => (
          <div key={device.id} className="min-w-0 rounded-lg border">
            <button
              type="button"
              aria-expanded={expanded === device.id}
              className="flex w-full items-center gap-3 p-3 text-left"
              onClick={() => setExpanded((cur) => (cur === device.id ? null : device.id))}
            >
              <div className="flex size-9 shrink-0 items-center justify-center rounded-md border bg-muted/50">
                <Cpu className="size-4" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate text-sm font-medium">{device.name}</span>
                  <Status device={device} />
                </div>
                <p className="truncate text-xs text-muted-foreground">
                  {agents.find((a) => a.id === device.agentId)?.name ?? "No agent"}
                  {device.role === "member" && " · shared with you"}
                </p>
              </div>
              <ChevronDown
                className={cn(
                  "size-4 shrink-0 text-muted-foreground transition-transform",
                  expanded === device.id && "rotate-180"
                )}
              />
            </button>
            {expanded === device.id && (
              <div className="grid grid-cols-[minmax(0,1fr)] gap-4 border-t p-3">
                {(() => {
                  const shown = pairings[device.id]
                  const panel = shown && (
                    <DevicePairingPanel
                      device={device}
                      pairing={shown.pairing}
                      onNewCode={async () => {
                        const next = await pair(device.id)
                        if (next) showPairing(device.id, next, shown.top)
                      }}
                      onClose={() => {
                        if (device.pairingExpiresAt) void cancelPairing(device.id)
                        hidePairing(device.id)
                      }}
                    />
                  )
                  return (
                    <>
                      {shown?.top && panel}
                      <DeviceDetails
                        device={device}
                        agents={agents}
                        onUpdate={(changes) => update(device.id, changes)}
                        pairingPanel={shown && !shown.top ? panel : undefined}
                        onPair={
                          shown
                            ? undefined
                            : async () => {
                                const next = await pair(device.id)
                                if (next) showPairing(device.id, next, false)
                              }
                        }
                        onDelete={() => remove(device.id)}
                      />
                    </>
                  )
                })()}
              </div>
            )}
          </div>
        ))
      )}
    </div>
  )
}

function Status({ device }: { device: Device }) {
  if (device.online) {
    return (
      <Badge variant="secondary" className="gap-1.5 text-xs">
        <span className="size-1.5 rounded-full bg-emerald-500" />
        Online
      </Badge>
    )
  }
  const waiting = device.pairingExpiresAt && !device.lastSeenAt
  return (
    <span className="truncate text-xs text-muted-foreground">
      {waiting
        ? "Waiting to pair"
        : device.lastSeenAt
          ? `Offline · seen ${timeAgo(device.lastSeenAt)}`
          : "Never connected"}
    </span>
  )
}

function AddDeviceForm({
  agents,
  onAdd,
  onCancel,
}: {
  agents: Agent[]
  onAdd: (input: { name: string; description?: string; agent_id?: string }) => Promise<void>
  onCancel: () => void
}) {
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [agentId, setAgentId] = useState(NEW_AGENT)
  const [saving, setSaving] = useState(false)

  const submit = async () => {
    setSaving(true)
    await onAdd({
      name: name.trim(),
      ...(description.trim() && { description: description.trim() }),
      ...(agentId !== NEW_AGENT && { agent_id: agentId }),
    })
    setSaving(false)
  }

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-3 rounded-lg border p-3">
      <div className="grid gap-2">
        <Label htmlFor="device-name">Name</Label>
        <Input id="device-name" value={name} placeholder="Dino" maxLength={100} onChange={(e) => setName(e.target.value)} />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="device-description">Description</Label>
        <Textarea
          id="device-description"
          value={description}
          maxLength={1000}
          placeholder="What it is and what it's for, e.g. a small rover with a camera that watches the garden."
          onChange={(e) => setDescription(e.target.value)}
        />
        <p className="text-xs text-muted-foreground">Agents read it to know what the device is for.</p>
      </div>
      <div className="grid gap-2">
        <Label htmlFor="device-agent">Agent</Label>
        <Select value={agentId} onValueChange={setAgentId}>
          <SelectTrigger id="device-agent" className="w-full min-w-0">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NEW_AGENT}>A new agent named after the device</SelectItem>
            {agents.map((agent) => (
              <SelectItem key={agent.id} value={agent.id}>
                {agent.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          The agent the device works for: its instructions and memories. Another device on the same
          agent shares them.
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button disabled={!name.trim() || saving} onClick={() => void submit()} className="gap-2">
          {saving && <Loader2 className="size-4 animate-spin" />}
          Add and pair
        </Button>
        <Button variant="ghost" disabled={saving} onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  )
}
