import { useSyncExternalStore } from "react"
import type { ProviderType } from "@/lib/api"

// The model the user picked in the status bar. Lives outside React so the chat
// transport (lib/chat.ts, not a component) can read it when building requests;
// persisted so the choice survives reloads. null → the backend's env default.
export type ActiveModel = { provider: ProviderType; model: string }

const STORAGE_KEY = "agent-ui:active-model"

function load(): ActiveModel | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<ActiveModel>
    if (typeof parsed.provider !== "string" || typeof parsed.model !== "string") return null
    return parsed as ActiveModel
  } catch {
    return null
  }
}

let current: ActiveModel | null = load()
const listeners = new Set<() => void>()

export function getActiveModel(): ActiveModel | null {
  return current
}

export function setActiveModel(next: ActiveModel | null): void {
  current = next
  if (next) localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  else localStorage.removeItem(STORAGE_KEY)
  listeners.forEach((fn) => fn())
}

function subscribe(fn: () => void): () => void {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

export function useActiveModel(): ActiveModel | null {
  return useSyncExternalStore(subscribe, getActiveModel)
}
