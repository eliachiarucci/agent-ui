import { getToolName, isToolUIPart, type UIMessage } from "ai"
import { TextPart } from "@/components/chat/parts/text-part"
import { ReasoningPart } from "@/components/chat/parts/reasoning-part"
import { ToolPart } from "@/components/chat/parts/tool-part"
import { cn } from "@/lib/utils"

export function Message({ message }: { message: UIMessage }) {
  const isUser = message.role === "user"

  if (isUser) {
    const text = message.parts
      .filter((p) => p.type === "text")
      .map((p) => p.text)
      .join("\n")
    return (
      <div className="flex justify-end">
        <div className="max-w-[75%] rounded-2xl rounded-br-sm bg-primary px-4 py-2.5 text-sm whitespace-pre-wrap text-primary-foreground">
          {text}
        </div>
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
