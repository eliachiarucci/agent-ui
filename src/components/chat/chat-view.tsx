import { useChat, type Chat } from "@ai-sdk/react"
import { MessageList } from "@/components/chat/message-list"
import { ChatInput } from "@/components/chat/chat-input"
import { StatusBar } from "@/components/chat/status-bar"
import { EmptyState } from "@/components/chat/empty-state"
import type { AgentUIMessage } from "@/lib/api"

type ChatViewProps = {
  // Owned and cached by App so the stream survives switching conversations.
  chat: Chat<AgentUIMessage>
}

export function ChatView({ chat }: ChatViewProps) {
  const { messages, sendMessage, status, error, stop } = useChat({ chat })

  const busy = status === "submitted" || status === "streaming"

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {messages.length === 0 ? (
        <EmptyState onSuggestion={(text) => void sendMessage({ text })} />
      ) : (
        <MessageList messages={messages} status={status} error={error} />
      )}
      <ChatInput busy={busy} onSend={(text) => void sendMessage({ text })} onStop={() => void stop()} />
      <StatusBar messages={messages} />
    </div>
  )
}
