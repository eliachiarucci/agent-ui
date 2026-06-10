import { getToolName, isToolUIPart, type UIMessage } from "ai"

// Chat-side view of the backend's file tools (lib/agent/files.ts over in the
// agent repo): which tool calls reference a file the viewer can show.
const FILE_TOOL_NAMES = new Set(["writeFile", "editFile", "readFile", "presentFile"])

type MessagePart = UIMessage["parts"][number]

/** The file a finished, successful file-tool call worked on, if any. */
export function fileToolTarget(part: MessagePart): string | null {
  if (!isToolUIPart(part) || !FILE_TOOL_NAMES.has(getToolName(part))) return null
  if (part.state !== "output-available") return null
  // Tool failures come back as { error } values, not output-error states.
  const output = part.output as { error?: unknown } | undefined
  if (output && typeof output.error === "string") return null
  const name = (part.input as { name?: unknown } | undefined)?.name
  return typeof name === "string" && name.length > 0 ? name : null
}

/** Distinct files touched by file tools, in order of first appearance — the viewer's tabs. */
export function chatFileNames(messages: UIMessage[]): string[] {
  const names: string[] = []
  for (const message of messages) {
    for (const part of message.parts) {
      const name = fileToolTarget(part)
      if (name && !names.includes(name)) names.push(name)
    }
  }
  return names
}

/** Newest successful presentFile call in the conversation. */
export function latestPresentedFile(
  messages: UIMessage[]
): { name: string; toolCallId: string } | null {
  for (let i = messages.length - 1; i >= 0; i--) {
    const parts = messages[i].parts
    for (let j = parts.length - 1; j >= 0; j--) {
      const part = parts[j]
      if (!isToolUIPart(part) || getToolName(part) !== "presentFile") continue
      if (part.state !== "output-available") continue
      const output = part.output as { presented?: string }
      if (output?.presented) return { name: output.presented, toolCallId: part.toolCallId }
    }
  }
  return null
}
