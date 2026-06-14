import { getToolName, isToolUIPart, type UIMessage } from "ai"
import { Paperclip } from "lucide-react"
import { TextPart } from "@/components/chat/parts/text-part"
import { ReasoningPart } from "@/components/chat/parts/reasoning-part"
import { ToolPart } from "@/components/chat/parts/tool-part"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { attachmentsFromParts, fileDownloadUrl, isVisibleTextPart } from "@/lib/api"

export function Message({
  message,
  conversationId,
}: {
  message: UIMessage
  conversationId: string
}) {
  const isUser = message.role === "user"

  if (isUser) {
    const text = message.parts
      .filter(isVisibleTextPart)
      .map((p) => p.text)
      .join("\n")
    const attachments = attachmentsFromParts(message.parts)
    return (
      <div className="flex flex-col items-end gap-1.5">
        {text && (
          <div className="max-w-[75%] rounded-2xl rounded-br-sm bg-primary px-4 py-2.5 text-sm whitespace-pre-wrap text-primary-foreground">
            {text}
          </div>
        )}
        {attachments.length > 0 && (
          <div className="flex max-w-[75%] flex-wrap justify-end gap-1.5">
            {attachments.map((a) => (
              <Badge key={a.name} asChild variant="secondary" className="max-w-full gap-1">
                <a
                  href={fileDownloadUrl({ conversationId, name: a.name })}
                  download
                  title={`Download ${a.label}`}
                >
                  <Paperclip />
                  <span className="truncate">{a.label}</span>
                </a>
              </Badge>
            ))}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className={cn("flex flex-col gap-2", message.parts.length === 0 && "hidden")}>
      {message.parts.map((part, i) => {
        if (part.type === "text") {
          return <TextPart key={i} text={part.text} />
        }
        if (part.type === "reasoning") {
          return <ReasoningPart key={i} text={part.text} streaming={part.state === "streaming"} />
        }
        if (isToolUIPart(part)) {
          return <ToolPart key={i} part={part} toolName={getToolName(part)} />
        }
        return null
      })}
    </div>
  )
}
