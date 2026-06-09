import { useMemo } from "react"
import { useChat } from "@ai-sdk/react"
import { DefaultChatTransport, type UIMessage } from "ai"
import { MessageList } from "@/components/chat/message-list"
import { ChatInput } from "@/components/chat/chat-input"
import { EmptyState } from "@/components/chat/empty-state"

type ChatViewProps = {
  conversationId: string
  initialMessages: UIMessage[]
  onConversationSettled: () => void
}

export function ChatView({ conversationId, initialMessages, onConversationSettled }: ChatViewProps) {
  const transport = useMemo(
    () =>
      new DefaultChatTransport<UIMessage>({
        api: "/agent/conversation",
        // The backend expects {message, conversation_id} and rebuilds history server-side.
        prepareSendMessagesRequest: ({ id, messages }) => {
          const last = messages[messages.length - 1]
          const text =
            last?.parts
              .filter((p) => p.type === "text")
              .map((p) => p.text)
              .join("\n") ?? ""
          return { body: { message: text, conversation_id: id } }
        },
      }),
    []
  )

  const { messages, sendMessage, status, error, stop } = useChat({
    id: conversationId,
    messages: initialMessages,
    transport,
    onFinish: () => onConversationSettled(),
  })

  const busy = status === "submitted" || status === "streaming"

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {messages.length === 0 ? (
        <EmptyState onSuggestion={(text) => void sendMessage({ text })} />
      ) : (
        <MessageList messages={messages} status={status} error={error} />
      )}
      <ChatInput busy={busy} onSend={(text) => void sendMessage({ text })} onStop={() => void stop()} />
    </div>
  )
}
