import { useEffect, useRef } from "react"
import { isToolUIPart, type ChatStatus, type UIMessage } from "ai"
import { Loader2 } from "lucide-react"
import { Message } from "@/components/chat/message"

type MessageListProps = {
  messages: UIMessage[]
  status: ChatStatus
  error: Error | undefined
  // Conversation id, so message attachments can link to their stored file.
  conversationId: string
  // Id of the last message folded into the auto-compaction summary. Older
  // messages stay fully readable; a marker shows where the summary ends.
  summarizedThroughId?: string
  // True while the backend is summarizing this conversation in-band (shown as a
  // labeled indicator in place of the generic loader).
  compacting?: boolean
}

// The stream opens (status becomes "streaming") before the first token arrives,
// and the model keeps working between parts (e.g. reading a tool result before
// responding), so show the loader unless the last part is animating its own
// progress (streaming text/reasoning, or a tool spinner).
function isRenderingProgress(message: UIMessage | undefined): boolean {
  if (!message || message.role !== "assistant") return false
  const last = message.parts.at(-1)
  if (!last) return false
  if (last.type === "text") return last.text.length > 0 && last.state !== "done"
  if (last.type === "reasoning") return last.state === "streaming"
  if (isToolUIPart(last)) {
    return last.state === "input-streaming" || last.state === "input-available"
  }
  return false
}

export function MessageList({
  messages,
  status,
  error,
  conversationId,
  summarizedThroughId,
  compacting,
}: MessageListProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const stickToBottomRef = useRef(true)

  // Only show the marker if the summarized message is actually in this view
  // (it won't be in a brand-new chat object before the conversation loads).
  const showSummaryAfter =
    summarizedThroughId && messages.some((m) => m.id === summarizedThroughId)
      ? summarizedThroughId
      : undefined

  const chatActive = status === "submitted" || status === "streaming"

  const showLoader =
    status === "submitted" ||
    (status === "streaming" && !isRenderingProgress(messages[messages.length - 1]))

  const handleScroll = () => {
    const el = containerRef.current
    if (!el) return
    stickToBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 48
  }

  useEffect(() => {
    const el = containerRef.current
    if (el && stickToBottomRef.current) {
      el.scrollTop = el.scrollHeight
    }
  }, [messages])

  return (
    <div ref={containerRef} onScroll={handleScroll} className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-5 px-4 py-6">
        {messages.map((message, index) => (
          <div key={message.id} className="flex flex-col gap-5">
            <Message
              message={message}
              conversationId={conversationId}
              active={chatActive && index === messages.length - 1}
            />
            {message.id === showSummaryAfter && (
              <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                <div className="h-px flex-1 bg-border" />
                <span className="shrink-0">Earlier messages summarized for context</span>
                <div className="h-px flex-1 bg-border" />
              </div>
            )}
          </div>
        ))}

        {compacting ? (
          <div className="flex items-center gap-2 px-1 text-xs text-muted-foreground">
            <Loader2 className="size-3.5 animate-spin" />
            <span>Compacting earlier messages…</span>
          </div>
        ) : (
          showLoader && (
            <div className="flex items-center gap-1.5 px-1">
              <span className="size-2 animate-bounce rounded-full bg-muted-foreground/60 [animation-delay:0ms]" />
              <span className="size-2 animate-bounce rounded-full bg-muted-foreground/60 [animation-delay:150ms]" />
              <span className="size-2 animate-bounce rounded-full bg-muted-foreground/60 [animation-delay:300ms]" />
            </div>
          )
        )}

        {status === "error" && (
          <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error?.message ?? "Something went wrong. Please try again."}
          </div>
        )}
      </div>
    </div>
  )
}
