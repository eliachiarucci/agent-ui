import { useEffect, useRef, useState } from "react"
import { Check, ChevronDown, Copy, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { Device, DevicePairing } from "@/lib/api"
import { cn } from "@/lib/utils"

// How to set a device up: what a device is, the one command that installs
// agent-device on it and pairs it with the code (the server's install script,
// /agent/devices/install.sh), and whether the device has used the code.
export function DevicePairingPanel({
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
  const [ownSoftware, setOwnSoftware] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [])
  // It opens where the user clicked, which may be at the bottom of a long card.
  useEffect(() => {
    ref.current?.scrollIntoView({ block: "nearest", behavior: "smooth" })
  }, [pairing.code])

  // The server clears the code once the device used it.
  const paired = device.pairingExpiresAt === null
  const left = Math.max(0, new Date(pairing.expiresAt).getTime() - now)
  const expired = !paired && left === 0
  const install = `curl -fsSL ${window.location.origin}/agent/devices/install.sh | sh -s -- ${pairing.code}`

  if (paired) {
    return (
      <div
        ref={ref}
        className="flex flex-wrap items-center gap-2 rounded-md border border-emerald-500/40 bg-emerald-500/5 p-3 text-sm"
      >
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
    <div ref={ref} className="grid grid-cols-[minmax(0,1fr)] gap-3 rounded-md border bg-muted/30 p-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="text-sm font-medium">Set up {device.name}</span>
        <span className="text-xs text-muted-foreground">
          {expired ? "The code expired." : `The code works once, for ${Math.ceil(left / 60000)} more min.`}
        </span>
      </div>
      <p className="text-xs text-muted-foreground">
        A device is a computer with a camera, a microphone or a speaker (a laptop, a Raspberry Pi, a robot)
        that the agent sees, hears and speaks through. On that computer, open a terminal and run:
      </p>
      <CommandBox command={install} disabled={expired} />
      <p className="text-xs text-muted-foreground">
        It installs <span className="font-mono">agent-device</span>, the device app (and ffmpeg if it&apos;s
        missing), asks which camera, microphone and speaker to use, pairs with code{" "}
        <span className="font-mono text-foreground">{pairing.code}</span> and starts: as a service on
        Linux, in that terminal on a Mac. It runs on Apple Silicon Macs and 64-bit Linux (USB webcams).
        The device gets its own key; no key is shown here.
      </p>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-2">
        <button
          type="button"
          aria-expanded={ownSoftware}
          className="flex items-center gap-1 justify-self-start text-xs text-muted-foreground hover:text-foreground"
          onClick={() => setOwnSoftware((v) => !v)}
        >
          <ChevronDown className={cn("size-3.5 transition-transform", !ownSoftware && "-rotate-90")} />
          Using your own device software?
        </button>
        {ownSoftware && (
          <div className="grid grid-cols-[minmax(0,1fr)] gap-2 pl-4.5 text-xs text-muted-foreground">
            <p>
              Pair only: it installs nothing and writes this server&apos;s address and the device&apos;s key to{" "}
              <span className="font-mono">~/.config/agent-device/device.json</span>, for your software to
              connect with.
            </p>
            <CommandBox command={`${install} --pair-only`} disabled={expired} />
            <p>
              The device protocol is in{" "}
              <a
                className="underline underline-offset-2 hover:text-foreground"
                href="https://github.com/eliachiarucci/agent/blob/main/docs/devices.md"
                target="_blank"
                rel="noreferrer"
              >
                docs/devices.md
              </a>
              .
            </p>
          </div>
        )}
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

function CommandBox({ command, disabled }: { command: string; disabled?: boolean }) {
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(command)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // Clipboard access denied: the command is on screen to copy by hand.
    }
  }
  return (
    <div
      className={cn(
        "flex min-w-0 items-start gap-2 rounded-md border bg-background px-2 py-1.5",
        disabled && "opacity-50"
      )}
    >
      <code className="min-w-0 flex-1 font-mono text-xs break-all text-foreground">{command}</code>
      <Button
        variant="ghost"
        size="icon"
        className="size-6 shrink-0"
        aria-label="Copy the command"
        disabled={disabled}
        onClick={() => void copy()}
      >
        {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
      </Button>
    </div>
  )
}
