import { useState } from "react"
import { getToolName, isToolUIPart, type UIMessage } from "ai"
import { Paperclip } from "lucide-react"
import { TextPart } from "@/components/chat/parts/text-part"
import { ReasoningPart } from "@/components/chat/parts/reasoning-part"
import { ToolPart } from "@/components/chat/parts/tool-part"
import { FilePreviewDialog, type PreviewFile } from "@/components/files/file-preview-dialog"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { cachedImagePreview } from "@/lib/image-previews"
import { attachmentsFromParts, fileDownloadUrl, isVisibleTextPart } from "@/lib/api"

export function Message({
  message,
  conversationId,
  active = false,
}: {
  message: UIMessage
  conversationId: string
  // True only for the last message while the chat is still streaming. Gates the
  // reasoning spinner so an aborted (stopped) turn — whose reasoning part stays
  // stuck in `state: "streaming"` because it was never finalized — doesn't keep
  // spinning.
  active?: boolean
}) {
  const isUser = message.role === "user"
  // Image attachment opened in the preview popup (same one as the files view).
  const [preview, setPreview] = useState<PreviewFile | null>(null)

  if (isUser) {
    const text = message.parts
      .filter(isVisibleTextPart)
      .map((p) => p.text)
      .join("\n")
    const attachments = attachmentsFromParts(message.parts)
    const images = message.parts.filter((p) => p.type === "file")
    return (
      <div className="flex flex-col items-end gap-1.5">
        {images.length > 0 && (
          <div className="flex max-w-[75%] flex-wrap justify-end gap-1.5">
            {images.map((image, i) => {
              // Prefer the composer's local object URL: right after a first
              // send the download route 404s until the conversation row exists,
              // and a failed <img> never retries.
              const src =
                (image.filename && cachedImagePreview(conversationId, image.filename)) ||
                image.url
              return (
                <button
                  key={i}
                  type="button"
                  title={image.filename}
                  aria-label={`View ${image.filename ?? "attached image"}`}
                  onClick={() =>
                    image.filename &&
                    setPreview({ conversationId, name: image.filename, source: "upload" })
                  }
                  className="block cursor-pointer overflow-hidden rounded-xl border"
                >
                  <img
                    src={src}
                    alt={image.filename ?? "Attached image"}
                    loading="lazy"
                    className="size-28 object-cover"
                  />
                </button>
              )
            })}
          </div>
        )}
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
                  href={fileDownloadUrl({ conversationId, name: a.name, source: "upload" })}
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
        <FilePreviewDialog file={preview} onClose={() => setPreview(null)} />
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
          return (
            <ReasoningPart key={i} text={part.text} streaming={active && part.state === "streaming"} />
          )
        }
        if (isToolUIPart(part)) {
          return <ToolPart key={i} part={part} toolName={getToolName(part)} />
        }
        return null
      })}
    </div>
  )
}
