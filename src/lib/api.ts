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
const SETTINGS_URL = "/agent/settings"
const NOTES_URL = "/agent/notes"
const MEMORY_CONVERSATIONS_URL = "/agent/memory-conversations"
const MEMORY_POOLS_URL = "/agent/memory-pools"
const MEMORY_PROMPT_URL = "/agent/memory-prompt"
const JOBS_URL = "/agent/jobs"
const BACKUP_URL = "/agent/backup"
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

// Auto-compaction pointer (agent/lib/agent/compaction.ts): the model is fed a
// summary of everything up to `throughMessageId` plus the messages after it. The
// full history is still returned in `messages` — the UI shows it all and marks
// where the summary ends. null/absent until the conversation is first compacted.
export type CompactionState = {
  summary: string
  throughMessageId: string
  tokens: number
}

export type Conversation = {
  id: string
  agentId: string
  // Creator. Shared conversations are visible to every member of the agent.
  userId: string
  shared: boolean
  // Whether the agent's memory applies to this conversation (recall + saving).
  // Like `shared`, fixed server-side at creation.
  memory: boolean
  // Archived conversations are hidden from the default sidebar list but keep
  // everything else (still openable and searchable). Creator-toggled.
  archived: boolean
  messages: StoredMessage[]
  compaction?: CompactionState | null
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
  // The memory pool this agent reads/writes. null = no memory (no recall,
  // no memory tools, no background extraction) until a pool is attached.
  memoryPoolId: string | null
  // Model the background memory extractor runs on (owner-picked). null pair →
  // the backend's env-configured default model.
  memoryProvider: ProviderType | null
  memoryModel: string | null
  // The chat model's memory surface (memory instructions + tools + recalled
  // memories): owners can switch it off per agent and replace the built-in
  // instructions (null → the built-in ones).
  chatMemoryEnabled: boolean
  chatMemoryPrompt: string | null
  // The background extraction "second pass": owners can switch it off per
  // agent and replace the extractor's system prompt (null → the built-in one).
  memoryExtractionEnabled: boolean
  memoryExtractionPrompt: string | null
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

// A named memory store. Pools are decoupled from agents: one pool can back
// several agents (they share every memory), and an agent without a pool has
// its memory off. Owned by the creating user.
export type MemoryPool = {
  id: string
  ownerId: string
  name: string
  createdAt: string
  memoryCount: number
  // Agents currently attached to (reading/writing) this pool.
  agents: Array<{ id: string; name: string }>
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

// The backend excludes archived conversations by default; archived=true
// returns only the archived ones (the sidebar's "Archived" view).
export function listConversations(agentId?: string, archived?: boolean): Promise<Conversation[]> {
  const params = new URLSearchParams()
  if (agentId) params.set("agent_id", agentId)
  if (archived !== undefined) params.set("archived", String(archived))
  const query = params.toString()
  return request<Conversation[]>(query ? `${CONVERSATIONS_URL}?${query}` : CONVERSATIONS_URL)
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
  changes: {
    name?: string
    systemPrompt?: string | null
    // null detaches the pool (memory off for this agent).
    memoryPoolId?: string | null
    // Sent together (both null resets to the env default model).
    memoryProvider?: ProviderType | null
    memoryModel?: string | null
    chatMemoryEnabled?: boolean
    // null clears the override back to the built-in memory instructions.
    chatMemoryPrompt?: string | null
    memoryExtractionEnabled?: boolean
    // null clears the override back to the built-in extraction prompt.
    memoryExtractionPrompt?: string | null
  }
): Promise<Omit<Agent, "role">> {
  return request<Omit<Agent, "role">>(AGENTS_URL, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      id,
      ...(changes.name !== undefined && { name: changes.name }),
      ...(changes.systemPrompt !== undefined && { system_prompt: changes.systemPrompt }),
      ...(changes.memoryPoolId !== undefined && { memory_pool_id: changes.memoryPoolId }),
      ...(changes.memoryProvider !== undefined && { memory_provider: changes.memoryProvider }),
      ...(changes.memoryModel !== undefined && { memory_model: changes.memoryModel }),
      ...(changes.chatMemoryEnabled !== undefined && {
        chat_memory_enabled: changes.chatMemoryEnabled,
      }),
      ...(changes.chatMemoryPrompt !== undefined && {
        chat_memory_prompt: changes.chatMemoryPrompt,
      }),
      ...(changes.memoryExtractionEnabled !== undefined && {
        memory_extraction_enabled: changes.memoryExtractionEnabled,
      }),
      ...(changes.memoryExtractionPrompt !== undefined && {
        memory_extraction_prompt: changes.memoryExtractionPrompt,
      }),
    }),
  })
}

// The built-in memory prompts (the chat model's memory instructions and the
// background extractor's system prompt), offered as starting points when
// writing custom ones in Settings → Memories.
export function getDefaultMemoryPrompts(): Promise<{ chat: string; extraction: string }> {
  return request<{ chat: string; extraction: string }>(MEMORY_PROMPT_URL)
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

// Without a target it reports the user's default model (else the env default).
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

// Creator-only, reversible: archived chats disappear from the default list.
export function setConversationArchived(id: string, archived: boolean): Promise<Conversation> {
  return request<Conversation>(CONVERSATIONS_URL, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ id, archived }),
  })
}

// Without poolId the backend scopes to the default agent's attached pool;
// with it, to that pool directly (Settings → Memory).
export function listMemories(params?: {
  q?: string
  limit?: number
  poolId?: string
}): Promise<Memory[]> {
  const search = new URLSearchParams()
  if (params?.q) search.set("q", params.q)
  if (params?.limit) search.set("limit", String(params.limit))
  if (params?.poolId) search.set("pool_id", params.poolId)
  const qs = search.toString()
  return request<Memory[]>(qs ? `${MEMORIES_URL}?${qs}` : MEMORIES_URL)
}

export type MemoryInput = {
  content: string
  importance: number
  category: MemoryCategory
  pinned: boolean
}

export function createMemory(input: MemoryInput, poolId?: string): Promise<Memory> {
  return request<Memory>(MEMORIES_URL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ ...input, ...(poolId && { pool_id: poolId }) }),
  })
}

export function updateMemory(
  id: string,
  input: Partial<MemoryInput>,
  poolId?: string
): Promise<Memory> {
  return request<Memory>(MEMORIES_URL, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ id, ...input, ...(poolId && { pool_id: poolId }) }),
  })
}

export function deleteMemory(id: string, poolId?: string): Promise<void> {
  const search = new URLSearchParams({ id })
  if (poolId) search.set("pool_id", poolId)
  return request<void>(`${MEMORIES_URL}?${search.toString()}`, { method: "DELETE" })
}

// ── Memory pools ────────────────────────────────────────────────────────────

export function listMemoryPools(): Promise<MemoryPool[]> {
  return request<MemoryPool[]>(MEMORY_POOLS_URL)
}

export function createMemoryPool(name: string): Promise<MemoryPool> {
  return request<MemoryPool>(MEMORY_POOLS_URL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name }),
  })
}

// Permanently deletes the pool and every memory in it; agents using it are
// detached (their memory turns off until another pool is attached).
export function deleteMemoryPool(id: string): Promise<void> {
  return request<void>(`${MEMORY_POOLS_URL}?id=${encodeURIComponent(id)}`, {
    method: "DELETE",
  })
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

// Fetched (not a plain anchor) so a failure — pg_dump missing, version
// mismatch — surfaces as a thrown error for a toast instead of the browser
// saving the JSON error body as a broken backup file.
export async function downloadBackup(): Promise<void> {
  const res = await fetch(BACKUP_URL)
  if (!res.ok) {
    const body = await res.text().catch(() => "")
    let message = body
    try {
      const parsed = JSON.parse(body) as { error?: unknown }
      if (typeof parsed.error === "string") message = parsed.error
    } catch {
      /* not JSON */
    }
    throw new Error(message || `Request failed (${res.status}): ${res.statusText}`)
  }
  const disposition = res.headers.get("content-disposition") ?? ""
  const name = /filename="([^"]+)"/.exec(disposition)?.[1] ?? "agent-backup.dump"
  const url = URL.createObjectURL(await res.blob())
  const link = document.createElement("a")
  link.href = url
  link.download = name
  link.click()
  URL.revokeObjectURL(url)
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
  // Paused jobs stay in the list but the scheduler skips them; manual triggers
  // still run. Resuming recomputes nextRunAt so no missed slot fires a backlog.
  paused: boolean
  // What runs do with connector tools set to "ask": withhold them like "deny"
  // (default — nobody is there to approve) or run them unattended. Only
  // applies while the job runs; chatting in the run's conversation is a
  // normal interactive turn with the agent's regular permissions.
  askPolicy: CronAskPolicy
  nextRunAt: string
  createdAt: string
}

export type CronAskPolicy = "deny" | "allow"

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
  askPolicy?: CronAskPolicy
}

// PATCH payload: omitted fields keep their value; provider: null returns the
// job to the backend's default model; title: null lets the agent regenerate.
export type CronJobUpdate = {
  // Move the job to another agent the creator is a member of.
  agentId?: string
  title?: string | null
  prompt?: string
  daysOfWeek?: number[]
  time?: string
  recurrence?: CronRecurrence
  // Pause/resume. Resuming recomputes nextRunAt server-side from now.
  paused?: boolean
  provider?: ProviderType | null
  model?: string | null
  askPolicy?: CronAskPolicy
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
      ...(input.askPolicy ? { ask_policy: input.askPolicy } : {}),
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
      ...(input.agentId !== undefined && { agent_id: input.agentId }),
      ...(input.title !== undefined && { title: input.title }),
      ...(input.prompt !== undefined && { prompt: input.prompt }),
      ...(input.daysOfWeek !== undefined && { days_of_week: input.daysOfWeek }),
      ...(input.time !== undefined && { time: input.time }),
      ...(input.recurrence !== undefined && { recurrence: input.recurrence }),
      ...(input.paused !== undefined && { paused: input.paused }),
      ...(reschedules && { timezone: Intl.DateTimeFormat().resolvedOptions().timeZone }),
      ...(input.provider !== undefined && { provider: input.provider, model: input.model ?? null }),
      ...(input.askPolicy !== undefined && { ask_policy: input.askPolicy }),
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

export type ProviderType = "lmstudio" | "anthropic" | "google" | "deepinfra" | "tensorx" | "openrouter" | "openai"

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

// ── Connectors & tool permissions ───────────────────────────────────────────

const CONNECTORS_URL = "/agent/connectors"
const TOOL_PERMISSIONS_URL = "/agent/tool-permissions"

export type ConnectorType = "gmail"
export type ConnectorStatus = "disconnected" | "connected" | "error"

// One tool of a connector, as listed in the backend's catalog. `kind` groups
// the permission toggles (read vs write); `defaultLevel` is the effective
// level when the user never saved one ("allow" for reads, "ask" for writes).
export type ConnectorToolInfo = {
  name: string
  kind: "read" | "write"
  description: string
  defaultLevel: ToolPermissionLevel
}

// Catalog entry merged with the user's stored configuration. The client secret
// never comes back; the server only says whether one is stored.
export type ConnectorInfo = {
  connector: ConnectorType
  name: string
  scopes: string[]
  tools: ConnectorToolInfo[]
  // What the user must register on their OAuth client in Google Cloud.
  redirectUri: string
  clientId: string | null
  hasClientSecret: boolean
  status: ConnectorStatus
  // The connected Google account, once linked.
  email: string | null
  updatedAt: string | null
}

export function listConnectors(): Promise<ConnectorInfo[]> {
  return request<ConnectorInfo[]>(CONNECTORS_URL)
}

// clientSecret may be omitted on updates: the backend then reuses the stored one.
export function saveConnector(
  connector: ConnectorType,
  input: { clientId: string; clientSecret?: string }
): Promise<ConnectorInfo> {
  return request<ConnectorInfo>(`${CONNECTORS_URL}/${connector}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  })
}

// Disconnects (revoking the Google grant best-effort) and forgets the credentials.
export function deleteConnector(connector: ConnectorType): Promise<void> {
  return request<void>(`${CONNECTORS_URL}/${connector}`, { method: "DELETE" })
}

// Full-page navigation target that starts the OAuth flow: the backend 302s to
// Google's consent screen and the callback lands back on the SPA with
// ?connector=...&connector_status=... query params.
export function connectorAuthorizeUrl(connector: ConnectorType): string {
  return `${CONNECTORS_URL}/${connector}/authorize`
}

// Per-tool permission level, scoped to one agent:
// { [connector]: { [tool]: level } }. Missing keys mean "allow". "ask" pauses
// the turn on each call and shows an approval prompt in the chat.
export const TOOL_PERMISSION_LEVELS = ["deny", "ask", "allow"] as const
export type ToolPermissionLevel = (typeof TOOL_PERMISSION_LEVELS)[number]
export type ToolPermissions = Partial<
  Record<ConnectorType, Record<string, ToolPermissionLevel>>
>

export function getToolPermissions(agentId: string): Promise<ToolPermissions> {
  return request<{ permissions: ToolPermissions }>(
    `${TOOL_PERMISSIONS_URL}?agent_id=${encodeURIComponent(agentId)}`
  ).then((res) => res.permissions)
}

export function saveToolPermissions(
  agentId: string,
  permissions: ToolPermissions
): Promise<ToolPermissions> {
  return request<{ permissions: ToolPermissions }>(TOOL_PERMISSIONS_URL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ agent_id: agentId, permissions }),
  }).then((res) => res.permissions)
}

// Standing approval overrides: "always approve" decisions from the chat's
// approval prompts, one row per (connector, tool, target). target "*" covers
// every call of the tool. Created only by the approval prompt; this API lists
// and revokes them (Settings → Tools → Approvals).
const TOOL_APPROVALS_URL = "/agent/tool-approvals"

export type ToolApproval = {
  id: string
  connector: ConnectorType
  tool: string
  target: string
  createdAt: string
}

export function listToolApprovals(agentId: string): Promise<ToolApproval[]> {
  return request<{ approvals: ToolApproval[] }>(
    `${TOOL_APPROVALS_URL}?agent_id=${encodeURIComponent(agentId)}`
  ).then((res) => res.approvals)
}

export function deleteToolApproval(id: string): Promise<void> {
  return request<void>(`${TOOL_APPROVALS_URL}?id=${encodeURIComponent(id)}`, {
    method: "DELETE",
  })
}

// Read-only view of what the background memory extractor did per source
// conversation (lib/agent/memory-extraction.ts). Summaries for the list view…
export type MemoryConversationSummary = {
  id: string
  conversationId: string
  createdAt: string
  updatedAt: string
  exchangeCount: number
  preview: string
}

// …and flattened messages for the detail view.
export type MemoryConversationMessage = {
  role: "user" | "assistant" | "tool"
  text?: string
  toolCalls?: { toolName: string; input: unknown }[]
  toolResults?: { toolName: string; output: unknown }[]
}

export type MemoryConversationDetail = {
  id: string
  conversationId: string
  createdAt: string
  updatedAt: string
  messages: MemoryConversationMessage[]
}

export function listMemoryConversations(): Promise<MemoryConversationSummary[]> {
  return request<MemoryConversationSummary[]>(MEMORY_CONVERSATIONS_URL)
}

export function getMemoryConversation(id: string): Promise<MemoryConversationDetail> {
  return request<MemoryConversationDetail>(
    `${MEMORY_CONVERSATIONS_URL}?id=${encodeURIComponent(id)}`
  )
}

// The user's default model: used for chats with no explicit selection, and as
// the fallback for background work (scheduled jobs, memory). null = env default.
export type UserSettings = {
  defaultProvider: ProviderType | null
  defaultModel: string | null
}

export function getUserSettings(): Promise<UserSettings> {
  return request<UserSettings>(SETTINGS_URL)
}

// Sent as a pair (null on both resets to the env default model).
export function updateDefaultModel(
  provider: ProviderType | null,
  model: string | null
): Promise<UserSettings> {
  return request<UserSettings>(SETTINGS_URL, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ default_provider: provider, default_model: model }),
  })
}
