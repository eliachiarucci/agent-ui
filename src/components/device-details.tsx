import { useState, type ReactNode } from "react"
import { KeyRound, Loader2, Trash2 } from "lucide-react"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ModelPicker } from "@/components/model-picker"
import type { Agent, Device, DeviceSettingsPatch, SpeechProvider } from "@/lib/api"
import { DEVICE_JOBS, DEVICE_TOOLS, deviceCapabilities } from "@/lib/devices"

type Changes = { name?: string; description?: string | null; agent_id?: string; settings?: DeviceSettingsPatch }

const SPEECH_PROVIDERS: Array<{ value: SpeechProvider; label: string }> = [
  { value: "piper", label: "Piper (on the server)" },
  { value: "openai", label: "OpenAI" },
  { value: "soniox", label: "Soniox" },
]

// One device's settings, saved as they change. Members see them read-only.
export function DeviceDetails({
  device,
  agents,
  onUpdate,
  onPair,
  pairingPanel,
  onDelete,
}: {
  device: Device
  agents: Agent[]
  onUpdate: (changes: Changes) => Promise<boolean>
  // Absent while a pairing code is already showing.
  onPair?: () => Promise<void>
  // "Pair again"'s panel, shown where the button was.
  pairingPanel?: ReactNode
  onDelete: () => Promise<boolean>
}) {
  const owner = device.role === "owner"
  const caps = deviceCapabilities(device)
  const { settings } = device
  const save = (settingsPatch: DeviceSettingsPatch) => onUpdate({ settings: settingsPatch })

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-4">
      {!owner && <p className="text-xs text-muted-foreground">Only the device&apos;s owner can change it.</p>}

      <section className="grid grid-cols-[minmax(0,1fr)] gap-3">
        <div className="grid gap-2">
          <Label htmlFor={`${device.id}-name`}>Name</Label>
          <CommitInput
            id={`${device.id}-name`}
            value={device.name}
            disabled={!owner}
            maxLength={100}
            onCommit={(name) => (name.trim() ? onUpdate({ name: name.trim() }) : Promise.resolve(false))}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor={`${device.id}-description`}>Description</Label>
          <CommitInput
            id={`${device.id}-description`}
            multiline
            value={device.description ?? ""}
            disabled={!owner}
            maxLength={1000}
            placeholder="What it is and what it's for."
            onCommit={(description) => onUpdate({ description: description.trim() || null })}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor={`${device.id}-agent`}>Agent</Label>
          <Select
            value={device.agentId ?? undefined}
            disabled={!owner}
            onValueChange={(agentId) => void onUpdate({ agent_id: agentId })}
          >
            <SelectTrigger id={`${device.id}-agent`} className="w-full min-w-0">
              <SelectValue placeholder="No agent" />
            </SelectTrigger>
            <SelectContent>
              {agents.map((agent) => (
                <SelectItem key={agent.id} value={agent.id}>
                  {agent.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <SwitchRow
          id={`${device.id}-paused`}
          label="Paused"
          description="Stops the camera frames until switched back on."
          checked={settings.paused}
          disabled={!owner}
          onChange={(paused) => save({ paused })}
        />
      </section>

      <Separator />

      <section className="grid grid-cols-[minmax(0,1fr)] gap-3">
        <SectionTitle
          title="Jobs and models"
          description={
            caps.known
              ? "What runs a model for this device, and on which."
              : "What runs a model for this device, and on which. The list fits the device once it has connected."
          }
        />
        {DEVICE_JOBS.filter((job) => !job.needs || caps[job.needs]).map((job) => {
          const slot = settings[job.key]
          return (
            <div key={job.key} className="grid gap-2">
              <div className="flex items-center justify-between gap-3">
                <div className="grid min-w-0 gap-0.5">
                  <Label htmlFor={`${device.id}-job-${job.key}`}>{job.label}</Label>
                  <p className="text-xs text-muted-foreground">{job.description}</p>
                </div>
                <Switch
                  id={`${device.id}-job-${job.key}`}
                  checked={slot.enabled}
                  disabled={!owner}
                  aria-label={`${job.label} on`}
                  onCheckedChange={(enabled) => void save({ [job.key]: { enabled } })}
                />
              </div>
              <ModelPicker
                value={slot.provider && slot.model ? { provider: slot.provider, model: slot.model } : null}
                onChange={(next) =>
                  void save({ [job.key]: { provider: next?.provider ?? null, model: next?.model ?? null } })
                }
                disabled={!owner || !slot.enabled}
                emptyLabel={job.fallback}
                clearLabel={`Use: ${job.fallback.toLowerCase()}`}
                menuLabel={`${job.label} model`}
              />
            </div>
          )
        })}
      </section>

      <Separator />

      <section className="grid grid-cols-[minmax(0,1fr)] gap-3">
        <SectionTitle title="Tools" description="What the agent may do with this device, besides memory, notes and web search." />
        {DEVICE_TOOLS.filter((tool) => !tool.needs || caps[tool.needs]).map((tool) => (
          <SwitchRow
            key={tool.key}
            id={`${device.id}-tool-${tool.key}`}
            label={tool.label}
            description={tool.description}
            checked={!settings.tools.disabled.includes(tool.key)}
            disabled={!owner}
            onChange={(on) =>
              save({
                tools: {
                  disabled: on
                    ? settings.tools.disabled.filter((t) => t !== tool.key)
                    : [...settings.tools.disabled, tool.key],
                },
              })
            }
          />
        ))}
      </section>

      {caps.speaker && (
        <>
          <Separator />
          <SpeechSection device={device} disabled={!owner} save={save} />
        </>
      )}

      {owner && (
        <>
          <Separator />
          {pairingPanel}
          <div className="flex flex-wrap items-center gap-2">
            {onPair && (
              <Button variant="outline" size="sm" className="gap-2" onClick={() => void onPair()}>
                <KeyRound className="size-4" />
                Pair again
              </Button>
            )}
            <DeleteDevice name={device.name} onDelete={onDelete} />
          </div>
        </>
      )}
    </div>
  )
}

function SpeechSection({
  device,
  disabled,
  save,
}: {
  device: Device
  disabled: boolean
  save: (patch: DeviceSettingsPatch) => Promise<boolean>
}) {
  const { speech } = device.settings
  const quiet = speech.quietHours
  return (
    <section className="grid grid-cols-[minmax(0,1fr)] gap-3">
      <SectionTitle title="Speech" description="How the device's speaker sounds, and when it stays quiet." />
      <SwitchRow
        id={`${device.id}-muted`}
        label="Muted"
        description="Nothing is spoken: neither on the agent's own nor in answer to someone."
        checked={speech.muted}
        disabled={disabled}
        onChange={(muted) => save({ speech: { muted } })}
      />
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="grid min-w-0 gap-2">
          <Label htmlFor={`${device.id}-tts`}>Voice provider</Label>
          <Select
            value={speech.provider}
            disabled={disabled}
            onValueChange={(provider) => void save({ speech: { provider: provider as SpeechProvider } })}
          >
            <SelectTrigger id={`${device.id}-tts`} className="w-full min-w-0">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SPEECH_PROVIDERS.map((p) => (
                <SelectItem key={p.value} value={p.value}>
                  {p.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid min-w-0 gap-2">
          <Label htmlFor={`${device.id}-language`}>Language</Label>
          <CommitInput
            id={`${device.id}-language`}
            value={speech.language}
            disabled={disabled}
            maxLength={35}
            placeholder="en"
            onCommit={(language) =>
              language.trim().length >= 2 ? save({ speech: { language: language.trim() } }) : Promise.resolve(false)
            }
          />
        </div>
      </div>
      <div className="grid gap-2">
        <Label htmlFor={`${device.id}-voice`}>Voice</Label>
        <CommitInput
          id={`${device.id}-voice`}
          value={speech.voices[speech.language] ?? ""}
          disabled={disabled}
          maxLength={100}
          placeholder="The provider's default"
          onCommit={(voice) => {
            const others = Object.fromEntries(Object.entries(speech.voices).filter(([lang]) => lang !== speech.language))
            return save({ speech: { voices: voice.trim() ? { ...others, [speech.language]: voice.trim() } : others } })
          }}
        />
        <p className="text-xs text-muted-foreground">
          The voice for {speech.language}, by the provider&apos;s name for it (e.g. Adrian for Soniox).
        </p>
      </div>
      <SwitchRow
        id={`${device.id}-quiet`}
        label="Quiet hours"
        description="Nothing is spoken in this window, in the device's time zone."
        checked={quiet !== null}
        disabled={disabled}
        onChange={(on) => save({ speech: { quietHours: on ? { start: "22:00", end: "08:00" } : null } })}
      />
      {quiet && (
        <div className="grid grid-cols-2 gap-3">
          <div className="grid min-w-0 gap-2">
            <Label htmlFor={`${device.id}-quiet-start`}>From</Label>
            <CommitInput
              id={`${device.id}-quiet-start`}
              type="time"
              value={quiet.start}
              disabled={disabled}
              onCommit={(start) => (start ? save({ speech: { quietHours: { ...quiet, start } } }) : Promise.resolve(false))}
            />
          </div>
          <div className="grid min-w-0 gap-2">
            <Label htmlFor={`${device.id}-quiet-end`}>To</Label>
            <CommitInput
              id={`${device.id}-quiet-end`}
              type="time"
              value={quiet.end}
              disabled={disabled}
              onCommit={(end) => (end ? save({ speech: { quietHours: { ...quiet, end } } }) : Promise.resolve(false))}
            />
          </div>
        </div>
      )}
    </section>
  )
}

function SectionTitle({ title, description }: { title: string; description: string }) {
  return (
    <div className="grid gap-0.5">
      <h3 className="text-sm font-medium">{title}</h3>
      <p className="text-xs text-muted-foreground">{description}</p>
    </div>
  )
}

function SwitchRow({
  id,
  label,
  description,
  checked,
  disabled,
  onChange,
}: {
  id: string
  label: string
  description: string
  checked: boolean
  disabled?: boolean
  onChange: (checked: boolean) => Promise<boolean>
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="grid min-w-0 gap-0.5">
        <Label htmlFor={id}>{label}</Label>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <Switch id={id} checked={checked} disabled={disabled} onCheckedChange={(next) => void onChange(next)} />
    </div>
  )
}

// A text field saved when it loses focus (or on Enter, single line). While it
// isn't being edited it shows the stored value, so the page's polling keeps it current.
function CommitInput({
  value,
  onCommit,
  multiline,
  ...props
}: {
  id: string
  value: string
  onCommit: (value: string) => Promise<boolean>
  multiline?: boolean
  disabled?: boolean
  maxLength?: number
  placeholder?: string
  type?: string
}) {
  const [draft, setDraft] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const commit = async () => {
    if (draft === null) return
    if (draft !== value) {
      setSaving(true)
      await onCommit(draft)
      setSaving(false)
    }
    setDraft(null)
  }
  const shared = {
    ...props,
    value: draft ?? value,
    onFocus: () => setDraft(value),
    onBlur: () => void commit(),
    "aria-busy": saving,
  }

  return multiline ? (
    <Textarea {...shared} onChange={(e) => setDraft(e.target.value)} />
  ) : (
    <Input
      {...shared}
      onChange={(e) => setDraft(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.currentTarget.blur()
      }}
    />
  )
}

function DeleteDevice({ name, onDelete }: { name: string; onDelete: () => Promise<boolean> }) {
  const [deleting, setDeleting] = useState(false)
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="ghost" size="sm" className="ml-auto gap-2 text-destructive hover:text-destructive">
          <Trash2 className="size-4" />
          Delete
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete {name}?</AlertDialogTitle>
          <AlertDialogDescription>
            Its frames, captions and events are deleted and it is disconnected. Its agent, the agent&apos;s
            memories and its conversation stay.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            className="gap-2 bg-destructive text-white hover:bg-destructive/90"
            onClick={async (e) => {
              e.preventDefault()
              setDeleting(true)
              await onDelete()
              setDeleting(false)
            }}
          >
            {deleting && <Loader2 className="size-4 animate-spin" />}
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
