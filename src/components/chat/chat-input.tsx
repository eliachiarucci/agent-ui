import { useState } from "react"
import { ArrowUp, Square, X } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { randomUUID } from "@/lib/uuid"

// A file the user attached in the composer but hasn't sent yet. `content` is
// uploaded to the conversation on send; `name` is the stored file name.
export type PendingAttachment = {
  id: string
  name: string
  label: string
  content: string
}

// Pasting more than this many characters turns the clipboard text into a file
// attachment (a chip) instead of dumping it into the textarea.
const PASTE_AS_FILE_THRESHOLD = 5000

type ChatInputProps = {
  busy: boolean
  onSend: (text: string, attachments: PendingAttachment[]) => Promise<void> | void
  onStop: () => void
}

export function ChatInput({ busy, onSend, onStop }: ChatInputProps) {
  const [value, setValue] = useState("")
  const [attachments, setAttachments] = useState<PendingAttachment[]>([])
  // True only while attachments upload, before the stream sets `busy`.
  const [sending, setSending] = useState(false)

  const canSend = (value.trim() !== "" || attachments.length > 0) && !busy && !sending

  const submit = async () => {
    if (!canSend) return
    setSending(true)
    try {
      await onSend(value.trim(), attachments)
      setValue("")
      setAttachments([])
    } catch {
      // onSend surfaces the failure (toast); keep the text and chips for retry.
    } finally {
      setSending(false)
    }
  }

  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const text = e.clipboardData.getData("text/plain")
    if (text.length <= PASTE_AS_FILE_THRESHOLD) return
    // Long paste: keep the textarea clean and attach the content as a file.
    e.preventDefault()
    // Preview the start of the paste (whitespace collapsed to one line) so the
    // chip hints at what it holds, with the character count after it.
    const preview = text.replace(/\s+/g, " ").trim().slice(0, 15)
    setAttachments((prev) => [
      ...prev,
      {
        id: randomUUID(),
        // Unique within the conversation so two pastes never overwrite each other.
        name: `pasted-content-${randomUUID().slice(0, 8)}.txt`,
        label: `${preview}… - ${text.length.toLocaleString()} characters`,
        content: text,
      },
    ])
  }

  const removeAttachment = (id: string) =>
    setAttachments((prev) => prev.filter((a) => a.id !== id))

  return (
    <div className="border-t bg-background px-4 py-3">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-2">
        {attachments.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {attachments.map((a) => (
              <Badge key={a.id} variant="secondary" className="max-w-full gap-1 pr-1">
                <span className="truncate">{a.label}</span>
                <button
                  type="button"
                  aria-label="Remove attachment"
                  onClick={() => removeAttachment(a.id)}
                  className="-mr-0.5 rounded-full p-0.5 text-muted-foreground transition-colors hover:bg-foreground/10 hover:text-foreground"
                >
                  <X className="size-3" />
                </button>
              </Badge>
            ))}
          </div>
        )}
        <div className="flex items-end gap-2">
          <Textarea
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onPaste={handlePaste}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault()
                void submit()
              }
            }}
            placeholder="Message your agent… (Enter to send, Shift+Enter for a new line)"
            // py-3 makes a single text-sm line fill min-h-11 exactly, so the text
            // sits vertically centered in the empty input.
            className="max-h-40 min-h-11 flex-1 resize-none py-3"
            rows={1}
            autoFocus
          />
          {busy ? (
            <Button size="icon" variant="outline" aria-label="Stop generating" className="size-11" onClick={onStop}>
              <Square className="size-4" />
            </Button>
          ) : (
            <Button size="icon" aria-label="Send message" className="size-11" disabled={!canSend} onClick={() => void submit()}>
              <ArrowUp className="size-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
