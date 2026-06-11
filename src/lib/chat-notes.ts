import { getToolName, isToolUIPart, type UIMessage } from "ai"

// Chat-side view of the backend's note tools (lib/agent/notes.ts over in the
// agent repo): which tool calls reference a note the editor popup can open.
// deleteNote is excluded — its note no longer exists.
const NOTE_TOOL_NAMES = new Set(["writeNote", "editNote", "readNote"])

type MessagePart = UIMessage["parts"][number]

/** The note title a finished, successful note-tool call worked on, if any. */
export function noteToolTarget(part: MessagePart): string | null {
  if (!isToolUIPart(part) || !NOTE_TOOL_NAMES.has(getToolName(part))) return null
  if (part.state !== "output-available") return null
  // Tool failures come back as { error } values, not output-error states.
  const output = part.output as { error?: unknown } | undefined
  if (output && typeof output.error === "string") return null
  const title = (part.input as { title?: unknown } | undefined)?.title
  return typeof title === "string" && title.length > 0 ? title : null
}
