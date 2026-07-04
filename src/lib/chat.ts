import { Chat } from "@ai-sdk/react"
import {
  DefaultChatTransport,
  isToolOrDynamicToolUIPart,
  lastAssistantMessageIsCompleteWithApprovalResponses,
  type UIMessage,
} from "ai"
import { getActiveModel } from "@/lib/active-model"
import { attachmentsFromParts, isVisibleTextPart, type AgentUIMessage } from "@/lib/api"

// Per-chat send options, set by the UI before the first message goes out. The
// backend only honors agent_id/shared/memory when it creates the conversation
// row, so sending them on every request is harmless for existing conversations.
type ChatSendOptions = { agentId?: string; shared?: boolean; memory?: boolean }
const sendOptions = new Map<string, ChatSendOptions>()

export function setChatOptions(id: string, options: ChatSendOptions): void {
  sendOptions.set(id, options)
}

// Approval prompts where the user picked "always approve": flagged here by
// approval id before addToolApprovalResponse fires, consumed when the resume
// request is built (the backend then stores the standing tool+target override).
const approvalAlways = new Set<string>()

export function markApprovalAlways(approvalId: string): void {
  approvalAlways.add(approvalId)
}

// The decisions of a just-answered approval pause: tool parts the user moved to
// approval-responded on the last assistant message. Sent to the backend instead
// of a message; the server patches its stored history and resumes the turn.
function approvalResponsesFromMessage(message: UIMessage | undefined) {
  if (message?.role !== "assistant") return []
  return message.parts.flatMap((part) => {
    if (!isToolOrDynamicToolUIPart(part) || part.state !== "approval-responded") return []
    const approved = part.approval.approved
    return [
      {
        approval_id: part.approval.id,
        approved,
        ...(approved && approvalAlways.delete(part.approval.id) ? { always: true } : {}),
      },
    ]
  })
}

// The transport is stateless, so a single instance is shared by every chat.
const transport = new DefaultChatTransport<AgentUIMessage>({
  api: "/agent/conversation",
  // The backend expects {message, conversation_id} and rebuilds history
  // server-side. Two request shapes: a normal user message, or — when the last
  // message is the assistant's turn paused on approval prompts the user just
  // answered — the tool_approvals decisions that resume it.
  prepareSendMessagesRequest: ({ id, messages }) => {
    const last = messages[messages.length - 1]
    const toolApprovals = approvalResponsesFromMessage(last)
    const text =
      last?.role === "user"
        ? last.parts
            .filter(isVisibleTextPart)
            .map((p) => p.text)
            .join("\n")
        : ""
    // Files attached to this turn were already uploaded to the conversation; the
    // backend re-stores the marker and the agent reads them with readFile.
    const attachments = last?.role === "user" ? attachmentsFromParts(last.parts) : []
    const options = sendOptions.get(id)
    // Read at send time so mid-conversation model switches apply to the next turn.
    const active = getActiveModel()
    return {
      body: {
        message: text,
        conversation_id: id,
        ...(toolApprovals.length > 0 ? { tool_approvals: toolApprovals } : {}),
        ...(attachments.length > 0 ? { attachments } : {}),
        ...(options?.agentId ? { agent_id: options.agentId } : {}),
        ...(options?.shared !== undefined ? { shared: options.shared } : {}),
        ...(options?.memory !== undefined ? { memory: options.memory } : {}),
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

// Same indirection for the stream's transient data parts: the backend emits
// `data-compaction` status while it summarizes a long conversation in-band
// (after the answer, before the stream closes). The active ChatView registers a
// handler; keyed by id so a background chat's parts never drive another's UI.
type DataPart = { type: string; data?: unknown }
const dataCallbacks = new Map<string, (part: DataPart) => void>()

export function setChatDataCallback(id: string, cb: ((part: DataPart) => void) | undefined): void {
  if (cb) dataCallbacks.set(id, cb)
  else dataCallbacks.delete(id)
}

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
      onData: (part) => dataCallbacks.get(id)?.(part),
      // Resume automatically once every approval prompt of a paused turn has a
      // decision (addToolApprovalResponse from the approval UI).
      sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithApprovalResponses,
    })
    chats.set(id, chat)
  }
  return chat
}

export function discardChat(id: string): void {
  chats.delete(id)
  sendOptions.delete(id)
  finishCallbacks.delete(id)
  dataCallbacks.delete(id)
}
