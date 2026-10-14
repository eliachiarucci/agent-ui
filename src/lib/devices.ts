import type { Device, DeviceTool } from "@/lib/api"

// What a device has, from the hello it sent when it last connected. Before it
// has ever connected nothing is known, so the page offers everything.
export type DeviceCapabilitySet = { known: boolean; camera: boolean; speaker: boolean; microphone: boolean }

export function deviceCapabilities(device: Device): DeviceCapabilitySet {
  const caps = device.hello?.capabilities
  if (!device.hello) return { known: false, camera: true, speaker: true, microphone: true }
  return {
    known: true,
    camera: Boolean(caps?.sizes?.length),
    speaker: Boolean(caps?.audio?.length),
    microphone: Boolean(caps?.microphone?.length),
  }
}

// The jobs that run a model for a device: captions need a camera, voice a
// microphone; agent runs are always there.
export const DEVICE_JOBS = [
  {
    key: "perception",
    label: "Captioning",
    description: "Describes each new camera frame for the timeline, and wakes the agent when something matters.",
    needs: "camera",
    fallback: "Default model",
  },
  {
    key: "agent",
    label: "Agent runs",
    description: "Reads the captions and decides what to do: speak, look closer, remember.",
    needs: null,
    fallback: "Default model",
  },
  {
    key: "voice",
    label: "Voice",
    description: "Answers people who talk to the device.",
    needs: "microphone",
    fallback: "Same as agent runs",
  },
] as const

// The device's own tools in its agent's runs and voice turns.
export const DEVICE_TOOLS: ReadonlyArray<{
  key: DeviceTool
  label: string
  description: string
  needs: "camera" | "speaker"
}> = [
  { key: "speak", label: "Speak", description: "Say something through the speaker on its own.", needs: "speaker" },
  { key: "zoom", label: "Zoom", description: "Look closer at part of the newest frame.", needs: "camera" },
  {
    key: "takePicture",
    label: "Take a picture",
    description: "A fresh picture, when the answer depends on what's in front of it now.",
    needs: "camera",
  },
  {
    key: "searchObservations",
    label: "Search the timeline",
    description: "Look up what the camera saw earlier.",
    needs: "camera",
  },
]

/** "just now", "5 min ago", "3 h ago", "2 days ago" */
export function timeAgo(iso: string, now = Date.now()): string {
  const s = Math.max(0, (now - new Date(iso).getTime()) / 1000)
  if (s < 60) return "just now"
  if (s < 3600) return `${Math.floor(s / 60)} min ago`
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`
  const days = Math.floor(s / 86400)
  return `${days} day${days === 1 ? "" : "s"} ago`
}
