import type { UIMessage } from "ai"

// Routes are served by the agent backend (proxied via Vite: /agent -> localhost:3001).
const CONVERSATIONS_URL = "/agent/conversation"
const MEMORIES_URL = "/agent/memory"
const CONTEXT_URL = "/agent/context"
const AGENTS_URL = "/agent/agents"

// The backend attaches per-step token usage to assistant messages (see
// conversation.ts messageMetadata); the latest one is the current context size.
export type UsageMetadata = {
  usage?: {
    inputTokens?: number
    outputTokens?: number
    totalTokens?: number
  }
}

export type AgentUIMessage = UIMessage<UsageMetadata>

// Rows written before the UI message stream migration only have {role, content}.
export type LegacyMessage = { role: "user" | "assistant"; content: string }
export type StoredMessage = UIMessage | LegacyMessage

export type Conversation = {
  id: string
  agentId: string
  // Creator. Shared conversations are visible to every member of the agent.
  userId: string
  shared: boolean
  messages: StoredMessage[]
  createdAt: string
  updatedAt: string
}

// An agent the current user can talk to; role is theirs ("owner" | "member").
export type Agent = {
  id: string
  ownerId: string
  name: string
  createdAt: string
  role: "owner" | "member"
}

export const MEMORY_CATEGORIES = [
  "person",
  "family",
  "food",
  "health",
  "work",
  "event",
  "preference",
  "place",
  "other",
] as const

export type MemoryCategory = (typeof MEMORY_CATEGORIES)[number]

export type Memory = {
  id: string
  content: string
  importance: number
  category: MemoryCategory
  pinned: boolean
  createdAt: string
  lastAccessedAt: string
}

// The server prepends a machine-inserted <relevant-memories> text part to user
// messages (see agent/docs/memory.md); it is model context, not user input, and
// must be excluded anywhere user text is displayed or echoed back to the server.
export function isVisibleTextPart(
  part: UIMessage["parts"][number]
): part is Extract<UIMessage["parts"][number], { type: "text" }> {
  return part.type === "text" && !part.text.startsWith("<relevant-memories>")
}

export function toUIMessages(stored: StoredMessage[]): AgentUIMessage[] {
  return stored.map((m, i) =>
    "parts" in m
      ? (m as AgentUIMessage)
      : { id: `legacy-${i}`, role: m.role, parts: [{ type: "text", text: m.content }] }
  )
}

export function conversationTitle(conversation: Conversation): string {
  for (const message of conversation.messages) {
    if (message.role !== "user") continue
    const text =
      "parts" in message
        ? message.parts
            .filter(isVisibleTextPart)
            .map((p) => p.text)
            .join(" ")
        : message.content
    const trimmed = text.trim()
    if (trimmed) return trimmed.length > 60 ? trimmed.slice(0, 60) + "…" : trimmed
  }
  return "New conversation"
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init)
  if (!res.ok) {
    const body = await res.text().catch(() => "")
    throw new Error(`Request failed (${res.status}): ${body || res.statusText}`)
  }
  return res.status === 204 ? (undefined as T) : res.json()
}

export function listConversations(agentId?: string): Promise<Conversation[]> {
  const url = agentId
    ? `${CONVERSATIONS_URL}?agent_id=${encodeURIComponent(agentId)}`
    : CONVERSATIONS_URL
  return request<Conversation[]>(url)
}

export function listAgents(): Promise<Agent[]> {
  return request<Agent[]>(AGENTS_URL)
}

export async function createAgent(name: string): Promise<Agent> {
  // The create route returns the bare agent row; the creator is always its owner.
  const created = await request<Omit<Agent, "role">>(AGENTS_URL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name }),
  })
  return { ...created, role: "owner" }
}

export type ContextWindow = {
  model: string
  contextLength: number | null
}

export function getContextWindow(): Promise<ContextWindow> {
  return request<ContextWindow>(CONTEXT_URL)
}

export function deleteConversation(id: string): Promise<void> {
  return request<void>(`${CONVERSATIONS_URL}?id=${encodeURIComponent(id)}`, { method: "DELETE" })
}

export function listMemories(params?: { q?: string; limit?: number }): Promise<Memory[]> {
  const search = new URLSearchParams()
  if (params?.q) search.set("q", params.q)
  if (params?.limit) search.set("limit", String(params.limit))
  const qs = search.toString()
  return request<Memory[]>(qs ? `${MEMORIES_URL}?${qs}` : MEMORIES_URL)
}

export type MemoryInput = {
  content: string
  importance: number
  category: MemoryCategory
  pinned: boolean
}

export function createMemory(input: MemoryInput): Promise<Memory> {
  return request<Memory>(MEMORIES_URL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  })
}

export function updateMemory(id: string, input: Partial<MemoryInput>): Promise<Memory> {
  return request<Memory>(MEMORIES_URL, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ id, ...input }),
  })
}

export function deleteMemory(id: string): Promise<void> {
  return request<void>(`${MEMORIES_URL}?id=${encodeURIComponent(id)}`, { method: "DELETE" })
}
