import { useState } from "react"
import { ArrowUp, Square } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"

type ChatInputProps = {
  busy: boolean
  onSend: (text: string) => void
  onStop: () => void
}

export function ChatInput({ busy, onSend, onStop }: ChatInputProps) {
  const [value, setValue] = useState("")

  const submit = () => {
    const text = value.trim()
    if (!text || busy) return
    onSend(text)
    setValue("")
  }

  return (
    <div className="border-t bg-background px-4 py-3">
      <div className="mx-auto flex w-full max-w-4xl items-end gap-2">
        <Textarea
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault()
              submit()
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
          <Button size="icon" aria-label="Send message" className="size-11" disabled={!value.trim()} onClick={submit}>
            <ArrowUp className="size-4" />
          </Button>
        )}
      </div>
    </div>
  )
}
