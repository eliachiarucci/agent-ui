import { useChat, type Chat } from "@ai-sdk/react"
import { Lock, Users } from "lucide-react"
import { MessageList } from "@/components/chat/message-list"
import { ChatInput } from "@/components/chat/chat-input"
import { StatusBar } from "@/components/chat/status-bar"
import { EmptyState } from "@/components/chat/empty-state"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import type { AgentUIMessage } from "@/lib/api"

type ChatViewProps = {
  // Owned and cached by App so the stream survives switching conversations.
  chat: Chat<AgentUIMessage>
  // Private/shared choice for a conversation that hasn't started yet. The flag
  // is fixed at creation server-side, so the toggle disappears after the first
  // message.
  shared: boolean
  onSharedChange: (shared: boolean) => void
  // Fires as a message is sent, so the app can show a new conversation in the
  // sidebar immediately instead of waiting for the turn to finish.
  onMessageSent: (text: string) => void
}

export function ChatView({ chat, shared, onSharedChange, onMessageSent }: ChatViewProps) {
  const { messages, sendMessage, status, error, stop } = useChat({ chat })

  const busy = status === "submitted" || status === "streaming"
  const isNew = messages.length === 0

  const send = (text: string) => {
    onMessageSent(text)
    void sendMessage({ text })
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {isNew ? (
        <EmptyState onSuggestion={send} />
      ) : (
        <MessageList messages={messages} status={status} error={error} />
      )}
      {isNew && (
        <div className="px-4 pb-2">
          <div className="mx-auto flex w-full max-w-4xl items-center gap-3 rounded-md border bg-muted/40 px-3 py-2">
            {shared ? (
              <Users className="size-4 shrink-0 text-muted-foreground" />
            ) : (
              <Lock className="size-4 shrink-0 text-muted-foreground" />
            )}
            <div className="min-w-0 flex-1">
              <Label htmlFor="shared-toggle" className="text-sm">
                {shared ? "Shared conversation" : "Private conversation"}
              </Label>
              <p className="text-xs text-muted-foreground">
                {shared
                  ? "Everyone with access to this agent can see and continue this conversation."
                  : "Only you can see this conversation. The agent's memory is still shared with its members."}
              </p>
            </div>
            <Switch id="shared-toggle" checked={shared} onCheckedChange={onSharedChange} />
          </div>
        </div>
      )}
      <ChatInput busy={busy} onSend={send} onStop={() => void stop()} />
      <StatusBar messages={messages} />
    </div>
  )
}
