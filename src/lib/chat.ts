import { Chat } from "@ai-sdk/react"
import { DefaultChatTransport } from "ai"
import { getActiveModel } from "@/lib/active-model"
import { attachmentsFromParts, isVisibleTextPart, type AgentUIMessage } from "@/lib/api"

// Per-chat send options, set by the UI before the first message goes out. The
// backend only honors agent_id/shared when it creates the conversation row, so
// sending them on every request is harmless for existing conversations.
type ChatSendOptions = { agentId?: string; shared?: boolean }
const sendOptions = new Map<string, ChatSendOptions>()

export function setChatOptions(id: string, options: ChatSendOptions): void {
  sendOptions.set(id, options)
}

// The transport is stateless, so a single instance is shared by every chat.
const transport = new DefaultChatTransport<AgentUIMessage>({
  api: "/agent/conversation",
  // The backend expects {message, conversation_id} and rebuilds history server-side.
  prepareSendMessagesRequest: ({ id, messages }) => {
    const last = messages[messages.length - 1]
    const text =
      last?.parts
        .filter(isVisibleTextPart)
        .map((p) => p.text)
        .join("\n") ?? ""
    // Files attached to this turn were already uploaded to the conversation; the
    // backend re-stores the marker and the agent reads them with readFile.
    const attachments = last ? attachmentsFromParts(last.parts) : []
    const options = sendOptions.get(id)
    // Read at send time so mid-conversation model switches apply to the next turn.
    const active = getActiveModel()
    return {
      body: {
        message: text,
        conversation_id: id,
        ...(attachments.length > 0 ? { attachments } : {}),
        ...(options?.agentId ? { agent_id: options.agentId } : {}),
        ...(options?.shared !== undefined ? { shared: options.shared } : {}),
        ...(active ? { provider: active.provider, model: active.model } : {}),
        // The backend's scheduling tools interpret times in the sender's timezone.
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      },
    }
  },
})

// A Chat instance owns its stream independently of React: caching instances
// for the whole session means an in-flight response keeps streaming while the
// user is on another chat and is intact (live or finished) when they return.
const chats = new Map<string, Chat<AgentUIMessage>>()

// onFinish callbacks live outside the Chat instances and are refreshed on
// every getChat call: a Chat only stores the callback passed at creation, and
// the one from the creating render can close over not-yet-loaded state (e.g.
// an unvalidated active-agent id before the agent list resolves), which made
// the post-turn sidebar refresh query the wrong agent and wipe the list.
const finishCallbacks = new Map<string, () => void>()

export function getChat(
  id: string,
  initialMessages: AgentUIMessage[],
  onFinish: () => void
): Chat<AgentUIMessage> {
  finishCallbacks.set(id, onFinish)
  let chat = chats.get(id)
  if (!chat) {
    chat = new Chat<AgentUIMessage>({
      id,
      messages: initialMessages,
      transport,
      onFinish: () => finishCallbacks.get(id)?.(),
    })
    chats.set(id, chat)
  }
  return chat
}

export function discardChat(id: string): void {
  chats.delete(id)
  sendOptions.delete(id)
  finishCallbacks.delete(id)
}
