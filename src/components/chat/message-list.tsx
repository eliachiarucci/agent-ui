import { useEffect, useRef } from "react"
import { isToolUIPart, type ChatStatus, type UIMessage } from "ai"
import { Message } from "@/components/chat/message"

type MessageListProps = {
  messages: UIMessage[]
  status: ChatStatus
  error: Error | undefined
  // Conversation id, so message attachments can link to their stored file.
  conversationId: string
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

export function MessageList({ messages, status, error, conversationId }: MessageListProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const stickToBottomRef = useRef(true)

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
        {messages.map((message) => (
          <Message key={message.id} message={message} conversationId={conversationId} />
        ))}

        {showLoader && (
          <div className="flex items-center gap-1.5 px-1">
            <span className="size-2 animate-bounce rounded-full bg-muted-foreground/60 [animation-delay:0ms]" />
            <span className="size-2 animate-bounce rounded-full bg-muted-foreground/60 [animation-delay:150ms]" />
            <span className="size-2 animate-bounce rounded-full bg-muted-foreground/60 [animation-delay:300ms]" />
          </div>
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
