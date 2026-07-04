import { useEffect, useMemo, useState, type ReactNode } from "react"
import { useChat, type Chat } from "@ai-sdk/react"
import { isToolOrDynamicToolUIPart } from "ai"
import { Brain, Lock, LockOpen } from "lucide-react"
import { toast } from "sonner"
import { MessageList } from "@/components/chat/message-list"
import { ChatInput, type PendingAttachment } from "@/components/chat/chat-input"
import { StatusBar } from "@/components/chat/status-bar"
import { EmptyState } from "@/components/chat/empty-state"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { markApprovalAlways, setChatDataCallback } from "@/lib/chat"
import { ApprovalContext, type ApprovalActions } from "@/lib/approval-context"
import { useActiveModel } from "@/lib/active-model"
import { useDefaultModel } from "@/hooks/use-default-model"
import { formatAttachmentsMarker, uploadFile, type AgentUIMessage } from "@/lib/api"
import { cn } from "@/lib/utils"

type ChatViewProps = {
  // Owned and cached by App so the stream survives switching conversations.
  chat: Chat<AgentUIMessage>
  // Conversation title shown in the top bar ("New conversation" until it has one).
  title: string
  // Private/shared and memory choices. Both flags are fixed server-side at
  // creation, so the top-bar toggles only work while the conversation has no
  // messages; afterwards they just reflect the stored state.
  shared: boolean
  memory: boolean
  onSharedChange: (shared: boolean) => void
  onMemoryChange: (memory: boolean) => void
  // Fires as a message is sent, so the app can show a new conversation in the
  // sidebar immediately instead of waiting for the turn to finish.
  onMessageSent: (text: string) => void
  // Id of the last message folded into the auto-compaction summary, if any.
  summarizedThroughId?: string
  // Contextual controls hosted at the edges of the top bar (App's sidebar
  // reopen and file-viewer buttons).
  headerStart?: ReactNode
  headerEnd?: ReactNode
}

// Icon toggle in the top bar. Radix tooltips never open on disabled elements,
// so a locked toggle stays enabled and just ignores clicks — the tooltip keeps
// explaining the (now fixed) setting.
function HeaderToggle({
  label,
  tooltip,
  locked,
  onToggle,
  children,
}: {
  label: string
  tooltip: string
  locked: boolean
  onToggle: () => void
  children: ReactNode
}) {
  return (
    <Tooltip delayDuration={150}>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={cn(
            "size-7",
            locked && "cursor-default hover:bg-transparent dark:hover:bg-transparent"
          )}
          aria-label={label}
          aria-disabled={locked || undefined}
          onClick={() => {
            if (!locked) onToggle()
          }}
        >
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="max-w-64">
        {tooltip}
      </TooltipContent>
    </Tooltip>
  )
}

export function ChatView({
  chat,
  title,
  shared,
  memory,
  onSharedChange,
  onMemoryChange,
  onMessageSent,
  summarizedThroughId,
  headerStart,
  headerEnd,
}: ChatViewProps) {
  const { messages, sendMessage, status, error, stop, addToolApprovalResponse } = useChat({
    chat,
  })

  // A turn paused on approval prompts: the composer blocks (answering resumes
  // the same turn; a new message would deny the pending calls) and the prompts
  // in the message list carry the decision buttons via ApprovalContext.
  const approvalPending = useMemo(() => {
    const last = messages[messages.length - 1]
    return (
      last?.role === "assistant" &&
      last.parts.some(
        (part) => isToolOrDynamicToolUIPart(part) && part.state === "approval-requested"
      )
    )
  }, [messages])

  // Decisions flow through addToolApprovalResponse; once every pending prompt
  // has one, the chat auto-resends (sendAutomaticallyWhen in lib/chat.ts) and
  // the backend resumes the turn. "Always" is flagged first so the resume
  // request carries it and the backend stores the standing override.
  const approvalActions = useMemo<ApprovalActions>(
    () => ({
      respond: (approvalId, approved, always) => {
        if (approved && always) markApprovalAlways(approvalId)
        void addToolApprovalResponse({ id: approvalId, approved })
      },
    }),
    [addToolApprovalResponse]
  )

  // The backend compacts long conversations in-band: after the answer streams,
  // it holds the stream open while it summarizes, emitting `data-compaction`
  // status. The stream staying open keeps `status === "streaming"` (composer
  // blocked); this just surfaces a labeled indicator while it runs.
  const [compacting, setCompacting] = useState(false)
  useEffect(() => {
    setChatDataCallback(chat.id, (part) => {
      if (part.type === "data-compaction") {
        setCompacting((part.data as { status?: string } | undefined)?.status === "running")
      }
    })
    return () => setChatDataCallback(chat.id, undefined)
  }, [chat.id])
  // A finished/idle stream can never still be compacting (guards a missed
  // "done", e.g. a dropped connection).
  useEffect(() => {
    if (status !== "streaming") setCompacting(false)
  }, [status])

  const busy = status === "submitted" || status === "streaming"
  const isNew = messages.length === 0

  // A model must be selected to chat: the active override, else the account
  // default (there is no server fallback). With neither, sending is blocked and
  // the status-bar selector prompts the user to pick one.
  const active = useActiveModel()
  const { selected: defaultModel } = useDefaultModel()
  const hasModel = Boolean(active || defaultModel)

  // Attachments are uploaded to the conversation's workspace first, then the
  // message carries an <attached-files> marker (rendered as chips, read by the
  // agent via readFile). Upload failure aborts the send so the composer can
  // keep the chips for a retry.
  const send = async (text: string, attachments: PendingAttachment[] = []) => {
    if (!hasModel) {
      toast.error("Select a model first", {
        description: "Pick a default model in Settings → Models, or choose one in the status bar below.",
      })
      return
    }
    try {
      await Promise.all(
        attachments.map((a) =>
          uploadFile({
            conversationId: chat.id,
            name: a.name,
            content: a.content,
            contentType: "text/plain;charset=utf-8",
          })
        )
      )
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to attach file")
      throw e
    }
    onMessageSent(text || attachments[0]?.label || "Attachment")
    const parts: AgentUIMessage["parts"] = [
      ...(text ? [{ type: "text" as const, text }] : []),
      ...(attachments.length > 0
        ? [
            {
              type: "text" as const,
              text: formatAttachmentsMarker(
                attachments.map((a) => ({ name: a.name, label: a.label }))
              ),
            },
          ]
        : []),
    ]
    void sendMessage({ parts })
  }

  // Both settings lock once the conversation has its first message (they are
  // fixed server-side at creation).
  const lockedNote = " This was set when the conversation started and can't be changed."

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="flex h-9 shrink-0 items-center gap-1 border-b px-2">
        {headerStart}
        <h1 className="min-w-0 flex-1 truncate px-1 text-sm font-medium">{title}</h1>
        <HeaderToggle
          label={memory ? "Disable memory for this chat" : "Enable memory for this chat"}
          locked={!isNew}
          onToggle={() => onMemoryChange(!memory)}
          tooltip={
            (memory
              ? "Memory is on: the agent recalls stored memories and saves new facts from this chat."
              : "Memory is off: the agent won't recall or save memories in this chat.") +
            (isNew ? (memory ? " Click to turn it off." : " Click to turn it on.") : lockedNote)
          }
        >
          <span
            className={cn(
              "relative flex items-center justify-center",
              !memory && "text-muted-foreground"
            )}
          >
            <Brain className={cn("size-4", !memory && "opacity-50")} />
            {!memory && (
              <span className="absolute h-px w-4.5 -rotate-45 rounded-full bg-current" />
            )}
          </span>
        </HeaderToggle>
        <HeaderToggle
          label={shared ? "Make this chat private" : "Share this chat"}
          locked={!isNew}
          onToggle={() => onSharedChange(!shared)}
          tooltip={
            (shared
              ? "Shared conversation: everyone with access to this agent can see and continue it."
              : "Private conversation: only you can see it.") +
            (isNew
              ? shared
                ? " Click to make it private."
                : " Click to share it with everyone on this agent."
              : lockedNote)
          }
        >
          {shared ? <LockOpen className="size-4" /> : <Lock className="size-4" />}
        </HeaderToggle>
        {headerEnd}
      </header>
      {isNew ? (
        <EmptyState onSuggestion={send} />
      ) : (
        <ApprovalContext.Provider value={approvalActions}>
          <MessageList
            messages={messages}
            status={status}
            error={error}
            conversationId={chat.id}
            summarizedThroughId={summarizedThroughId}
            compacting={compacting}
          />
        </ApprovalContext.Provider>
      )}
      <ChatInput
        busy={busy}
        noModel={!hasModel}
        approvalPending={approvalPending}
        onSend={send}
        onStop={() => void stop()}
      />
      <StatusBar messages={messages} />
    </div>
  )
}
