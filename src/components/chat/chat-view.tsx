import { useEffect, useState } from "react"
import { useChat, type Chat } from "@ai-sdk/react"
import { Lock, Users } from "lucide-react"
import { toast } from "sonner"
import { MessageList } from "@/components/chat/message-list"
import { ChatInput, type PendingAttachment } from "@/components/chat/chat-input"
import { StatusBar } from "@/components/chat/status-bar"
import { EmptyState } from "@/components/chat/empty-state"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { setChatDataCallback } from "@/lib/chat"
import { useActiveModel } from "@/lib/active-model"
import { useDefaultModel } from "@/hooks/use-default-model"
import { formatAttachmentsMarker, uploadFile, type AgentUIMessage } from "@/lib/api"

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
  // Id of the last message folded into the auto-compaction summary, if any.
  summarizedThroughId?: string
}

export function ChatView({
  chat,
  shared,
  onSharedChange,
  onMessageSent,
  summarizedThroughId,
}: ChatViewProps) {
  const { messages, sendMessage, status, error, stop } = useChat({ chat })

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

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {isNew ? (
        <EmptyState onSuggestion={send} />
      ) : (
        <MessageList
          messages={messages}
          status={status}
          error={error}
          conversationId={chat.id}
          summarizedThroughId={summarizedThroughId}
          compacting={compacting}
        />
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
      <ChatInput busy={busy} noModel={!hasModel} onSend={send} onStop={() => void stop()} />
      <StatusBar messages={messages} />
    </div>
  )
}
