import { useEffect, useState } from "react"
import {
  ArrowLeft,
  CalendarClock,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronsUpDown,
  Loader2,
  Play,
  Plus,
  Trash2,
  XCircle,
} from "lucide-react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useCronJobs } from "@/hooks/use-cron-jobs"
import { useProviders } from "@/hooks/use-providers"
import {
  testProvider,
  type Agent,
  type CronJob,
  type CronJobRun,
  type CronRecurrence,
  type ProviderConfig,
  type ProviderType,
} from "@/lib/api"
import { cn } from "@/lib/utils"

type RecurringJobsDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  agents: Agent[]
  activeAgentId?: string
  // Opens the conversation a run produced (runs may belong to any agent).
  onOpenConversation: (conversationId: string, agentId: string) => void
}

const DAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
]
const DAY_ABBREVIATIONS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

const RECURRENCE_LABELS: Record<CronRecurrence, string> = {
  once: "Once",
  weekly: "Every week",
  biweekly: "Every 2 weeks",
  monthly: "Every month",
}

const PROVIDER_LABELS: Record<ProviderType, string> = {
  lmstudio: "LM Studio",
  anthropic: "Anthropic",
  google: "Google",
  deepinfra: "DeepInfra",
}

function scheduleSummary(job: CronJob): string {
  const days = job.daysOfWeek.map((d) => DAY_ABBREVIATIONS[d]).join(", ")
  return `${RECURRENCE_LABELS[job.recurrence]} on ${days} at ${job.time}`
}

export function RecurringJobsDialog({
  open,
  onOpenChange,
  agents,
  activeAgentId,
  onOpenConversation,
}: RecurringJobsDialogProps) {
  const { jobs, runs, loading, runningIds, create, update, remove, trigger } = useCronJobs(open)
  const [view, setView] = useState<"list" | "form">("list")
  // Set → the form edits this job; null → it creates a new one.
  const [editing, setEditing] = useState<CronJob | null>(null)

  // Reopening always lands on the run list, not a half-filled form.
  useEffect(() => {
    if (open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional: reset view on open
      setView("list")
      setEditing(null)
    }
  }, [open])

  const backToList = () => {
    setView("list")
    setEditing(null)
  }

  const submit = async (values: JobFormValues) => {
    try {
      if (editing) {
        await update(editing.id, {
          // Cleared title → null: the agent names the job on its next run.
          title: values.title || null,
          prompt: values.prompt,
          daysOfWeek: values.daysOfWeek,
          time: values.time,
          recurrence: values.recurrence,
          provider: values.model?.provider ?? null,
          model: values.model?.model ?? null,
        })
        toast.success("Job updated")
      } else {
        await create({
          agentId: values.agentId,
          ...(values.title ? { title: values.title } : {}),
          prompt: values.prompt,
          daysOfWeek: values.daysOfWeek,
          time: values.time,
          recurrence: values.recurrence,
          ...(values.model ? { provider: values.model.provider, model: values.model.model } : {}),
        })
        toast.success("Recurring job created")
      }
      backToList()
    } catch (error) {
      toast.error(editing ? "Failed to update job" : "Failed to create job", {
        description: error instanceof Error ? error.message : undefined,
      })
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* Fixed height so the dialog doesn't resize when switching views or as data loads. */}
      <DialogContent className="flex h-[min(85vh,44rem)] flex-col sm:max-w-2xl">
        {view === "list" ? (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <CalendarClock className="size-5" />
                Recurring Jobs
              </DialogTitle>
              <DialogDescription>
                Prompts that run on a schedule. Each run saves its result as a new conversation.
              </DialogDescription>
            </DialogHeader>

            <Button className="w-full justify-center gap-2" onClick={() => setView("form")}>
              <Plus className="size-4" />
              Add Recurring Job
            </Button>

            <div className="min-h-0 flex-1 overflow-y-auto pr-1">
              <div className="flex flex-col gap-4 py-1">
                {loading && (
                  <div className="flex flex-col gap-2">
                    {Array.from({ length: 4 }, (_, i) => (
                      <Skeleton key={i} className="h-14 w-full" />
                    ))}
                  </div>
                )}

                {!loading && jobs.length > 0 && (
                  <section>
                    <h3 className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                      Scheduled
                    </h3>
                    <div className="flex flex-col gap-2">
                      {jobs.map((job) => (
                        <JobCard
                          key={job.id}
                          job={job}
                          running={runningIds.has(job.id)}
                          onEdit={() => {
                            setEditing(job)
                            setView("form")
                          }}
                          onTrigger={() => void trigger(job)}
                          onDelete={() => void remove(job.id)}
                        />
                      ))}
                    </div>
                  </section>
                )}

                {!loading && jobs.length > 0 && <Separator />}

                {!loading && (
                  <section>
                    <h3 className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                      Previous runs
                    </h3>
                    {runs.length === 0 ? (
                      <p className="py-8 text-center text-sm text-muted-foreground">
                        {jobs.length === 0
                          ? "No recurring jobs yet. Add one to run a prompt on a schedule."
                          : "No runs yet — the first one will show up here."}
                      </p>
                    ) : (
                      <div className="flex flex-col gap-2">
                        {runs.map((run) => (
                          <RunCard
                            key={run.id}
                            run={run}
                            onOpen={
                              run.conversationId
                                ? () => onOpenConversation(run.conversationId!, run.agentId)
                                : undefined
                            }
                          />
                        ))}
                      </div>
                    )}
                  </section>
                )}
              </div>
            </div>
          </>
        ) : (
          <>
            <DialogHeader>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Back to job list"
                  className="-ml-2 shrink-0"
                  onClick={backToList}
                >
                  <ArrowLeft className="size-4" />
                </Button>
                <DialogTitle>{editing ? "Edit Recurring Job" : "New Recurring Job"}</DialogTitle>
              </div>
              <DialogDescription>
                {editing
                  ? "Schedule changes take effect immediately; the next run is recomputed."
                  : "The prompt runs as you, against the chosen agent, at every scheduled time."}
              </DialogDescription>
            </DialogHeader>

            <div className="min-h-0 flex-1 overflow-y-auto pr-1">
              <JobForm
                // Remount on target change so state re-initializes from `initial`.
                key={editing?.id ?? "new"}
                agents={agents}
                activeAgentId={activeAgentId}
                initial={editing ?? undefined}
                onSubmit={submit}
              />
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}

function JobCard({
  job,
  running,
  onEdit,
  onTrigger,
  onDelete,
}: {
  job: CronJob
  running: boolean
  onEdit: () => void
  onTrigger: () => void
  onDelete: () => void
}) {
  return (
    <div className="group flex items-center gap-3 rounded-md border px-3 py-2">
      <button
        type="button"
        className="min-w-0 flex-1 text-left"
        aria-label={`Edit job "${job.title ?? job.prompt}"`}
        onClick={onEdit}
      >
        <p className="truncate text-sm font-medium">{job.title ?? job.prompt}</p>
        {job.title && <p className="truncate text-xs text-muted-foreground">{job.prompt}</p>}
        <p className="text-xs text-muted-foreground">
          {job.agentName} · {scheduleSummary(job)} · next{" "}
          {new Date(job.nextRunAt).toLocaleString([], {
            dateStyle: "medium",
            timeStyle: "short",
          })}
          {job.provider && job.model && (
            <>
              {" · "}
              {PROVIDER_LABELS[job.provider]} · {job.model}
            </>
          )}
        </p>
      </button>
      <Button
        variant="ghost"
        size="icon"
        aria-label={running ? "Run in progress" : `Run "${job.prompt}" now`}
        title="Run now"
        className="shrink-0 opacity-60 hover:opacity-100"
        disabled={running}
        onClick={onTrigger}
      >
        {running ? <Loader2 className="size-4 animate-spin" /> : <Play className="size-4" />}
      </Button>
      <Button
        variant="ghost"
        size="icon"
        aria-label={`Delete job "${job.prompt}"`}
        className="shrink-0 opacity-60 hover:text-destructive hover:opacity-100"
        onClick={onDelete}
      >
        <Trash2 className="size-4" />
      </Button>
    </div>
  )
}

// Clickable (opens the run's conversation) when the run produced one.
function RunCard({ run, onOpen }: { run: CronJobRun; onOpen?: () => void }) {
  const content = (
    <>
      {run.status === "success" ? (
        <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
      ) : (
        <XCircle className="mt-0.5 size-4 shrink-0 text-destructive" />
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{run.title ?? run.prompt}</p>
        <p className="text-xs text-muted-foreground">
          {run.agentName} ·{" "}
          {new Date(run.startedAt).toLocaleString([], {
            dateStyle: "medium",
            timeStyle: "short",
          })}
        </p>
        {run.error && <p className="mt-1 text-xs text-destructive">{run.error}</p>}
      </div>
      <Badge variant={run.status === "error" ? "destructive" : "secondary"} className="shrink-0">
        {run.status}
      </Badge>
    </>
  )

  if (!onOpen) {
    return <div className="flex items-start gap-3 rounded-md border px-3 py-2">{content}</div>
  }
  return (
    <button
      type="button"
      className="flex items-start gap-3 rounded-md border px-3 py-2 text-left hover:bg-accent/60"
      onClick={onOpen}
    >
      {content}
    </button>
  )
}

type JobModel = { provider: ProviderType; model: string } | null

// Same provider → live model list flow as the chat's status-bar selector
// (components/chat/model-selector.tsx), but writing to form state instead of
// the global active-model store.
function ModelPicker({ value, onChange }: { value: JobModel; onChange: (v: JobModel) => void }) {
  const { providers } = useProviders()
  const [expanded, setExpanded] = useState<ProviderType | null>(null)
  // undefined = not fetched yet, "loading" = in flight, [] = fetched but empty.
  const [modelsByProvider, setModelsByProvider] = useState<
    Partial<Record<ProviderType, string[] | "loading">>
  >({})

  const label = value ? `${PROVIDER_LABELS[value.provider]} · ${value.model}` : "Default model"

  const toggleProvider = async (config: ProviderConfig) => {
    const provider = config.provider
    setExpanded((cur) => (cur === provider ? null : provider))
    if (modelsByProvider[provider] !== undefined) return
    setModelsByProvider((cur) => ({ ...cur, [provider]: "loading" }))
    // The stored API key is filled in server-side; LM Studio just needs its URL.
    const { models } = await testProvider(
      provider,
      provider === "lmstudio" ? { url: config.settings.url } : {}
    ).catch(() => ({ models: [] as string[] }))
    const sorted = [...models].sort((a, b) =>
      a.localeCompare(b, undefined, { sensitivity: "base" })
    )
    setModelsByProvider((cur) => ({ ...cur, [provider]: sorted }))
  }

  return (
    <DropdownMenu
      onOpenChange={(open) => {
        // Fresh model lists (LM Studio's change as models load) per menu open.
        if (open) {
          setExpanded(null)
          setModelsByProvider({})
        }
      }}
    >
      <DropdownMenuTrigger className="flex h-9 w-full items-center justify-between gap-2 rounded-md border bg-transparent px-3 text-sm outline-none hover:bg-accent/40 data-[state=open]:bg-accent/40">
        <span className="truncate">{label}</span>
        <ChevronsUpDown className="size-3.5 shrink-0 text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-72">
        <DropdownMenuLabel className="text-xs">Model</DropdownMenuLabel>
        {providers.length === 0 && (
          <div className="px-2 py-1.5 text-xs text-muted-foreground">
            No providers configured — add one in Settings → Models.
          </div>
        )}
        {providers.map((config) => {
          const provider = config.provider
          const models = modelsByProvider[provider]
          const isExpanded = expanded === provider
          return (
            <div key={provider}>
              <DropdownMenuItem
                // Providers expand in place; only model clicks close the menu.
                onSelect={(e) => {
                  e.preventDefault()
                  void toggleProvider(config)
                }}
              >
                <ChevronDown
                  className={cn("size-3.5 transition-transform", !isExpanded && "-rotate-90")}
                />
                {PROVIDER_LABELS[provider]}
              </DropdownMenuItem>
              {isExpanded &&
                (models === "loading" || models === undefined ? (
                  <div className="flex items-center gap-2 py-1.5 pl-8 pr-2 text-xs text-muted-foreground">
                    <Loader2 className="size-3 animate-spin" />
                    Loading models…
                  </div>
                ) : models.length === 0 ? (
                  <div className="py-1.5 pl-8 pr-2 text-xs text-muted-foreground">
                    No models available.
                  </div>
                ) : (
                  models.map((model) => {
                    const isActive = value?.provider === provider && value.model === model
                    return (
                      <DropdownMenuItem
                        key={model}
                        className="pl-8 text-xs"
                        onSelect={() => onChange({ provider, model })}
                      >
                        <span className="truncate">{model}</span>
                        {isActive && <Check className="ml-auto size-3.5 shrink-0" />}
                      </DropdownMenuItem>
                    )
                  })
                ))}
            </div>
          )
        })}
        {value && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-xs" onSelect={() => onChange(null)}>
              Use default model
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

// What the form collects; the dialog maps it to a create or update payload.
type JobFormValues = {
  agentId: string
  // Trimmed; "" means "no title" (the agent names the job on its next run).
  title: string
  prompt: string
  daysOfWeek: number[]
  time: string
  recurrence: CronRecurrence
  model: JobModel
}

type JobFormProps = {
  agents: Agent[]
  activeAgentId?: string
  // Pre-fills the form for editing; the agent is fixed then.
  initial?: CronJob
  onSubmit: (values: JobFormValues) => Promise<void>
}

function JobForm({ agents, activeAgentId, initial, onSubmit }: JobFormProps) {
  const [agentId, setAgentId] = useState(initial?.agentId ?? activeAgentId ?? agents[0]?.id ?? "")
  const [title, setTitle] = useState(initial?.title ?? "")
  const [days, setDays] = useState<number[]>(initial?.daysOfWeek ?? [1])
  const [time, setTime] = useState(initial?.time ?? "09:00")
  const [recurrence, setRecurrence] = useState<CronRecurrence>(initial?.recurrence ?? "weekly")
  const [model, setModel] = useState<JobModel>(
    initial?.provider && initial.model
      ? { provider: initial.provider, model: initial.model }
      : null
  )
  const [prompt, setPrompt] = useState(initial?.prompt ?? "")
  const [submitting, setSubmitting] = useState(false)

  const toggleDay = (day: number) =>
    setDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort((a, b) => a - b)
    )

  const valid = agentId !== "" && time !== "" && days.length > 0 && prompt.trim() !== ""

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!valid || submitting) return
    setSubmitting(true)
    try {
      await onSubmit({
        agentId,
        title: title.trim(),
        prompt: prompt.trim(),
        daysOfWeek: days,
        time,
        recurrence,
        model,
      })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form className="flex flex-col gap-4 py-1" onSubmit={handleSubmit}>
      <div className="flex flex-col gap-2">
        <Label htmlFor="job-title">Title</Label>
        <Input
          id="job-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Optional — the agent names it on the first run"
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label>Days of the week</Label>
        <div className="flex flex-wrap gap-1.5">
          {DAY_ABBREVIATIONS.map((name, day) => (
            <Button
              key={name}
              type="button"
              size="sm"
              variant={days.includes(day) ? "default" : "outline"}
              className="w-12 rounded-full"
              aria-pressed={days.includes(day)}
              aria-label={DAY_NAMES[day]}
              onClick={() => toggleDay(day)}
            >
              {name}
            </Button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="job-time">Time</Label>
          <Input
            id="job-time"
            type="time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
            required
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="job-recurrence">Repeats</Label>
          <Select value={recurrence} onValueChange={(v) => setRecurrence(v as CronRecurrence)}>
            <SelectTrigger id="job-recurrence" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(RECURRENCE_LABELS).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {recurrence === "once" && (
            <p className="text-xs text-muted-foreground">
              Runs at the next selected day &amp; time, then deletes itself.
            </p>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="job-agent">Agent</Label>
          {/* A job is pinned to its agent (memory pool, runs, permissions). */}
          <Select value={agentId} onValueChange={setAgentId} disabled={initial !== undefined}>
            <SelectTrigger id="job-agent" className="w-full">
              <SelectValue placeholder="Pick an agent" />
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

        <div className="flex flex-col gap-2">
          <Label>Model</Label>
          <ModelPicker value={model} onChange={setModel} />
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="job-prompt">Prompt</Label>
        <Textarea
          id="job-prompt"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="What should the agent do on each run?"
          rows={5}
          required
        />
      </div>

      <Button type="submit" disabled={!valid || submitting}>
        {submitting ? "Saving…" : initial ? "Save changes" : "Create job"}
      </Button>
    </form>
  )
}
