import { Chat } from "@ai-sdk/react"
import { DefaultChatTransport } from "ai"
import { isVisibleTextPart, type AgentUIMessage } from "@/lib/api"

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
    const options = sendOptions.get(id)
    return {
      body: {
        message: text,
        conversation_id: id,
        ...(options?.agentId ? { agent_id: options.agentId } : {}),
        ...(options?.shared !== undefined ? { shared: options.shared } : {}),
      },
    }
  },
})

// A Chat instance owns its stream independently of React: caching instances
// for the whole session means an in-flight response keeps streaming while the
// user is on another chat and is intact (live or finished) when they return.
const chats = new Map<string, Chat<AgentUIMessage>>()

export function getChat(
  id: string,
  initialMessages: AgentUIMessage[],
  onFinish: () => void
): Chat<AgentUIMessage> {
  let chat = chats.get(id)
  if (!chat) {
    chat = new Chat<AgentUIMessage>({ id, messages: initialMessages, transport, onFinish })
    chats.set(id, chat)
  }
  return chat
}

export function discardChat(id: string): void {
  chats.delete(id)
  sendOptions.delete(id)
}
