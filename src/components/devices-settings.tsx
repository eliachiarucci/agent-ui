import { useEffect, useState } from "react"
import { Check, ChevronDown, Copy, Cpu, Loader2, Plus } from "lucide-react"
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
  // Codes shown this session, by device; the server keeps only their hashes.
  const [pairings, setPairings] = useState<Record<string, DevicePairing>>({})

  const showPairing = (id: string, pairing: DevicePairing) => {
    setPairings((cur) => ({ ...cur, [id]: pairing }))
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
            showPairing(created.device.id, created.pairing)
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
                {pairings[device.id] && (
                  <PairingPanel
                    device={device}
                    pairing={pairings[device.id]}
                    onNewCode={async () => {
                      const next = await pair(device.id)
                      if (next) showPairing(device.id, next)
                    }}
                    onClose={() => {
                      if (device.pairingExpiresAt) void cancelPairing(device.id)
                      hidePairing(device.id)
                    }}
                  />
                )}
                <DeviceDetails
                  device={device}
                  agents={agents}
                  onUpdate={(changes) => update(device.id, changes)}
                  onPair={
                    pairings[device.id]
                      ? undefined
                      : async () => {
                          const next = await pair(device.id)
                          if (next) showPairing(device.id, next)
                        }
                  }
                  onDelete={() => remove(device.id)}
                />
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

// The code to type on the device, how to use it, and whether the device took it.
function PairingPanel({
  device,
  pairing,
  onNewCode,
  onClose,
}: {
  device: Device
  pairing: DevicePairing
  onNewCode: () => Promise<void>
  onClose: () => void
}) {
  const [now, setNow] = useState(() => Date.now())
  const [copied, setCopied] = useState(false)
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [])

  // The server clears the code once the device used it.
  const paired = device.pairingExpiresAt === null
  const left = Math.max(0, new Date(pairing.expiresAt).getTime() - now)
  const expired = !paired && left === 0
  const server = window.location.origin
  const command = `sudo rover-agent pair ${server} ${pairing.code}`

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(command)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // Clipboard access denied; the command is on screen to copy by hand.
    }
  }

  if (paired) {
    return (
      <div className="flex flex-wrap items-center gap-2 rounded-md border border-emerald-500/40 bg-emerald-500/5 p-3 text-sm">
        {device.online ? (
          <Check className="size-4 text-emerald-600" />
        ) : (
          <Loader2 className="size-4 animate-spin text-muted-foreground" />
        )}
        <span className="min-w-0 flex-1">
          {device.online ? `Paired. ${device.name} is online.` : `Paired. Waiting for ${device.name} to connect…`}
        </span>
        <Button variant="ghost" size="sm" onClick={onClose}>
          Done
        </Button>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-3 rounded-md border bg-muted/30 p-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="text-sm font-medium">Pair {device.name}</span>
        <span className="text-xs text-muted-foreground">
          {expired ? "The code expired." : `Code valid for ${Math.ceil(left / 60000)} min, once.`}
        </span>
      </div>
      <div className="font-mono text-2xl tracking-widest" aria-label="Pairing code">
        {expired ? <span className="text-muted-foreground line-through">{pairing.code}</span> : pairing.code}
      </div>
      <div className="grid gap-1.5 text-xs text-muted-foreground">
        <p>
          On the device, run its pairing command with this server&apos;s address and the code. The device
          gets its own key from the server; no key is shown here. For the rover service:
        </p>
        <div className="flex min-w-0 items-center gap-2 rounded-md border bg-background px-2 py-1.5">
          <code className="min-w-0 flex-1 truncate font-mono text-foreground" title={command}>
            {command}
          </code>
          <Button variant="ghost" size="icon" className="size-6 shrink-0" aria-label="Copy the command" onClick={() => void copy()}>
            {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
          </Button>
        </div>
        <p>
          Server: <span className="font-mono text-foreground">{server}</span>. Pairing again later replaces
          the device&apos;s key.
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {expired ? (
          <Button size="sm" onClick={() => void onNewCode()}>
            New code
          </Button>
        ) : (
          <span className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="size-3 animate-spin" />
            Waiting for the device…
          </span>
        )}
        <Button variant="ghost" size="sm" className="ml-auto" onClick={onClose}>
          Cancel
        </Button>
      </div>
    </div>
  )
}
