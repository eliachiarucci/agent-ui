import type { UIMessage } from "ai"

// Routes are served by the agent backend (proxied via Vite: /agent -> localhost:3001).
const CONVERSATIONS_URL = "/agent/conversation"
const MEMORIES_URL = "/agent/memory"
const FILES_URL = "/agent/files"
const FILE_DOWNLOAD_URL = "/agent/files/download"
const CONTEXT_URL = "/agent/context"
const AGENTS_URL = "/agent/agents"
const PROVIDERS_URL = "/agent/providers"
const PROVIDER_TEST_URL = "/agent/provider-test"
const NOTES_URL = "/agent/notes"
const JOBS_URL = "/agent/jobs"
const JOB_RUNS_URL = "/agent/jobs/runs"

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
  // Owner-written instructions appended to the backend's system prompt.
  systemPrompt: string | null
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

// Prefix of the machine-inserted text part that lists files the user attached
// to a message. The backend's matching constant is ATTACHED_FILES_MARKER in
// agent/lib/agent/files.ts — keep the two literals in sync.
export const ATTACHMENTS_MARKER = "<attached-files>"

// A file attached to a message (e.g. long pasted content uploaded as a file):
// `name` is the stored file name, `label` is the chip text shown to the user.
export type Attachment = { name: string; label: string }

export function formatAttachmentsMarker(attachments: Attachment[]): string {
  return ATTACHMENTS_MARKER + JSON.stringify(attachments)
}

function parseAttachmentsMarker(text: string): Attachment[] | null {
  if (!text.startsWith(ATTACHMENTS_MARKER)) return null
  try {
    const data = JSON.parse(text.slice(ATTACHMENTS_MARKER.length)) as unknown
    if (!Array.isArray(data)) return null
    return data.filter(
      (a): a is Attachment =>
        !!a && typeof a.name === "string" && typeof a.label === "string"
    )
  } catch {
    return null
  }
}

// Attachments carried by a message, read from its <attached-files> text part.
export function attachmentsFromParts(parts: UIMessage["parts"]): Attachment[] {
  for (const part of parts) {
    if (part.type === "text") {
      const parsed = parseAttachmentsMarker(part.text)
      if (parsed) return parsed
    }
  }
  return []
}

// The server prepends a machine-inserted <relevant-memories> text part to user
// messages (see agent/docs/memory.md), and attached files ride along as an
// <attached-files> part; both are model context, not user input, and must be
// excluded anywhere user text is displayed or echoed back to the server.
export function isVisibleTextPart(
  part: UIMessage["parts"][number]
): part is Extract<UIMessage["parts"][number], { type: "text" }> {
  return (
    part.type === "text" &&
    !part.text.startsWith("<relevant-memories>") &&
    !part.text.startsWith(ATTACHMENTS_MARKER)
  )
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
    // Backend errors are { error: string } — surface the message alone so
    // toasts stay readable; fall back to the raw body for anything else.
    let message = body
    try {
      const parsed = JSON.parse(body) as { error?: unknown }
      if (typeof parsed.error === "string") message = parsed.error
    } catch {
      /* not JSON */
    }
    throw new Error(message || `Request failed (${res.status}): ${res.statusText}`)
  }
  return res.status === 204 ? (undefined as T) : res.json()
}

export function listConversations(agentId?: string): Promise<Conversation[]> {
  const url = agentId
    ? `${CONVERSATIONS_URL}?agent_id=${encodeURIComponent(agentId)}`
    : CONVERSATIONS_URL
  return request<Conversation[]>(url)
}

// Single conversation by id (the backend's list route filters on id). Used to
// open conversations that aren't in the loaded sidebar list, e.g. ones a
// recurring job created server-side.
export async function getConversation(id: string): Promise<Conversation | undefined> {
  const rows = await request<Conversation[]>(
    `${CONVERSATIONS_URL}?id=${encodeURIComponent(id)}`
  )
  return rows[0]
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

// Owner-only on the backend. The update route returns the bare row (no role).
export function updateAgent(
  id: string,
  changes: { name?: string; systemPrompt?: string | null }
): Promise<Omit<Agent, "role">> {
  return request<Omit<Agent, "role">>(AGENTS_URL, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      id,
      ...(changes.name !== undefined && { name: changes.name }),
      ...(changes.systemPrompt !== undefined && { system_prompt: changes.systemPrompt }),
    }),
  })
}

// Owner-only on the backend; cascades to the agent's memories, conversations,
// and memberships.
export function deleteAgent(id: string): Promise<void> {
  return request<void>(`${AGENTS_URL}?id=${encodeURIComponent(id)}`, { method: "DELETE" })
}

export type ContextWindow = {
  model: string
  contextLength: number | null
}

// Without a target it reports the backend's env-configured default model.
export function getContextWindow(target?: {
  provider: ProviderType
  model: string
}): Promise<ContextWindow> {
  const url = target
    ? `${CONTEXT_URL}?provider=${encodeURIComponent(target.provider)}&model=${encodeURIComponent(target.model)}`
    : CONTEXT_URL
  return request<ContextWindow>(url)
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

// ── Files ───────────────────────────────────────────────────────────────────

// A file the agent saved in a conversation's folder. The backend lists them
// flat across every conversation the viewer can see in the agent.
export type StoredFile = {
  conversationId: string
  name: string
  size: number
  updatedAt: string
}

export function listFiles(agentId?: string): Promise<StoredFile[]> {
  const url = agentId ? `${FILES_URL}?agent_id=${encodeURIComponent(agentId)}` : FILES_URL
  return request<StoredFile[]>(url)
}

// Uploads raw file bytes into a conversation's workspace. The body is the file
// content verbatim (default content type keeps the backend's express.json() from
// touching the stream); name and conversation ride in the query string. Used for
// pasted-content attachments today; documents and images will reuse it.
export function uploadFile(params: {
  conversationId: string
  name: string
  content: Blob | string
  contentType?: string
}): Promise<StoredFile> {
  const { conversationId, name, content, contentType } = params
  return request<StoredFile>(
    `${FILES_URL}?conversation_id=${encodeURIComponent(conversationId)}&name=${encodeURIComponent(name)}`,
    {
      method: "POST",
      headers: { "content-type": contentType ?? "application/octet-stream" },
      body: content,
    }
  )
}

// Plain href, no fetch: the browser handles the attachment download itself.
export function fileDownloadUrl(file: Pick<StoredFile, "conversationId" | "name">): string {
  return `${FILE_DOWNLOAD_URL}?conversation_id=${encodeURIComponent(file.conversationId)}&name=${encodeURIComponent(file.name)}`
}

export type FileContent = {
  name: string
  content: string
  size: number
  updatedAt: string
}

// Backs the file viewer; it polls this and re-renders when updatedAt moves.
export function getFileContent(
  file: Pick<StoredFile, "conversationId" | "name">
): Promise<FileContent> {
  return request<FileContent>(
    `${FILES_URL}/content?conversation_id=${encodeURIComponent(file.conversationId)}&name=${encodeURIComponent(file.name)}`
  )
}

// ── Notes ───────────────────────────────────────────────────────────────────

// A shared note: agent-wide (visible to every member, from every conversation),
// editable both by the agent's note tools and manually in the Notes view.
// Titles are unique within an agent.
export type Note = {
  id: string
  agentId: string
  createdBy: string | null
  title: string
  content: string
  createdAt: string
  updatedAt: string
}

export function listNotes(agentId?: string): Promise<Note[]> {
  const url = agentId ? `${NOTES_URL}?agent_id=${encodeURIComponent(agentId)}` : NOTES_URL
  return request<Note[]>(url)
}

export function createNote(input: {
  title: string
  content: string
  agentId?: string
}): Promise<Note> {
  return request<Note>(NOTES_URL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      title: input.title,
      content: input.content,
      ...(input.agentId ? { agent_id: input.agentId } : {}),
    }),
  })
}

export function updateNote(
  id: string,
  changes: { title?: string; content?: string },
  agentId?: string
): Promise<Note> {
  return request<Note>(NOTES_URL, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ id, ...changes, ...(agentId ? { agent_id: agentId } : {}) }),
  })
}

export function deleteNote(id: string, agentId?: string): Promise<void> {
  const url = agentId
    ? `${NOTES_URL}?id=${encodeURIComponent(id)}&agent_id=${encodeURIComponent(agentId)}`
    : `${NOTES_URL}?id=${encodeURIComponent(id)}`
  return request<void>(url, { method: "DELETE" })
}

// ── Recurring jobs ──────────────────────────────────────────────────────────

// "once" jobs (reminders) are deleted after their first successful run.
export const CRON_RECURRENCES = ["once", "weekly", "biweekly", "monthly"] as const
export type CronRecurrence = (typeof CRON_RECURRENCES)[number]

export type CronJob = {
  id: string
  agentId: string
  // Joined in by the backend for display.
  agentName: string
  userId: string
  // Display name; null until the runner generates one on the next run.
  title: string | null
  prompt: string
  // 0 = Sunday … 6 = Saturday; at least one.
  daysOfWeek: number[]
  // "HH:MM" wall clock in `timezone`.
  time: string
  recurrence: CronRecurrence
  timezone: string
  // Model the runs use; null → the backend's env-configured default.
  provider: ProviderType | null
  model: string | null
  nextRunAt: string
  createdAt: string
}

export type CronJobInput = {
  agentId: string
  // Empty/omitted → the agent generates a title on the job's next run.
  title?: string
  prompt: string
  daysOfWeek: number[]
  time: string
  recurrence: CronRecurrence
  provider?: ProviderType
  model?: string
}

// PATCH payload: omitted fields keep their value; provider: null returns the
// job to the backend's default model; title: null lets the agent regenerate.
export type CronJobUpdate = {
  title?: string | null
  prompt?: string
  daysOfWeek?: number[]
  time?: string
  recurrence?: CronRecurrence
  provider?: ProviderType | null
  model?: string | null
}

// A finished run; carries its job's prompt and agent name so the history list
// reads on its own. conversationId points at the conversation holding the
// run's output (null if the run failed before creating one, or it was deleted).
export type CronJobRun = {
  id: string
  // Null once the job is gone (deleted by the user, or a completed "once" job).
  jobId: string | null
  conversationId: string | null
  status: "success" | "error"
  error: string | null
  startedAt: string
  finishedAt: string
  // Job title at run time; display falls back to the prompt when null.
  title: string | null
  prompt: string
  agentId: string
  agentName: string
}

export function listCronJobs(): Promise<CronJob[]> {
  return request<CronJob[]>(JOBS_URL)
}

export function createCronJob(input: CronJobInput): Promise<CronJob> {
  return request<CronJob>(JOBS_URL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      agent_id: input.agentId,
      ...(input.title ? { title: input.title } : {}),
      prompt: input.prompt,
      days_of_week: input.daysOfWeek,
      time: input.time,
      recurrence: input.recurrence,
      // The schedule is wall-clock in the creator's timezone; the backend
      // computes the absolute run instants from it.
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      ...(input.provider ? { provider: input.provider, model: input.model } : {}),
    }),
  })
}

// Fire-and-forget: the backend answers 202 and the run lands in the history
// when it finishes (poll listCronRuns).
export function triggerCronJob(id: string): Promise<{ started: boolean }> {
  return request<{ started: boolean }>(`${JOBS_URL}/trigger`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ id }),
  })
}

// Schedule changes (daysOfWeek/time/recurrence) reschedule the job from now,
// in the editor's current timezone.
export function updateCronJob(id: string, input: CronJobUpdate): Promise<CronJob> {
  const reschedules =
    input.daysOfWeek !== undefined || input.time !== undefined || input.recurrence !== undefined
  return request<CronJob>(JOBS_URL, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      id,
      ...(input.title !== undefined && { title: input.title }),
      ...(input.prompt !== undefined && { prompt: input.prompt }),
      ...(input.daysOfWeek !== undefined && { days_of_week: input.daysOfWeek }),
      ...(input.time !== undefined && { time: input.time }),
      ...(input.recurrence !== undefined && { recurrence: input.recurrence }),
      ...(reschedules && { timezone: Intl.DateTimeFormat().resolvedOptions().timeZone }),
      ...(input.provider !== undefined && { provider: input.provider, model: input.model ?? null }),
    }),
  })
}

export function deleteCronJob(id: string): Promise<void> {
  return request<void>(`${JOBS_URL}?id=${encodeURIComponent(id)}`, { method: "DELETE" })
}

export function listCronRuns(): Promise<CronJobRun[]> {
  return request<CronJobRun[]>(JOB_RUNS_URL)
}

// ── Model providers ─────────────────────────────────────────────────────────

export type ProviderType = "lmstudio" | "anthropic" | "google" | "deepinfra"

// What the user types into a provider card. apiKey may be omitted on updates:
// the backend then reuses the stored key.
export type ProviderSettingsInput = {
  url?: string
  apiKey?: string
  model?: string
}

// Stored config as returned by the backend. API keys never come back; the
// server only says whether one is stored.
export type ProviderConfig = {
  id: string
  provider: ProviderType
  settings: { url?: string; model?: string; hasApiKey: boolean }
  createdAt: string
  updatedAt: string
}

export function listProviders(): Promise<ProviderConfig[]> {
  return request<ProviderConfig[]>(PROVIDERS_URL)
}

// Verifies the connection server-side without saving; returns the provider's
// available models (used to populate the model picker).
export function testProvider(
  provider: ProviderType,
  settings: ProviderSettingsInput
): Promise<{ models: string[] }> {
  return request<{ models: string[] }>(PROVIDER_TEST_URL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ provider, settings }),
  })
}

// The backend re-tests the connection and saves only on success (422 otherwise).
export function saveProvider(
  provider: ProviderType,
  settings: ProviderSettingsInput
): Promise<{ provider: ProviderConfig; models: string[] }> {
  return request<{ provider: ProviderConfig; models: string[] }>(PROVIDERS_URL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ provider, settings }),
  })
}

export function deleteProvider(provider: ProviderType): Promise<void> {
  return request<void>(`${PROVIDERS_URL}?provider=${encodeURIComponent(provider)}`, {
    method: "DELETE",
  })
}
