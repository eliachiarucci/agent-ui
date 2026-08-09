import { useRef, useState } from "react"
import { ArrowUp, Loader2, Paperclip, Square, X } from "lucide-react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import {
  IMAGE_FILE_ACCEPT,
  IMAGE_MEDIA_TYPES,
  deleteUploadedFile,
  imageMediaTypeFor,
  uploadFile,
} from "@/lib/api"
import { cacheImagePreview } from "@/lib/image-previews"
import { cn } from "@/lib/utils"
import { randomUUID } from "@/lib/uuid"

// A file the user attached in the composer but hasn't sent yet. `content` is
// uploaded to the conversation on send; `name` is the stored file name.
export type PendingAttachment = {
  id: string
  name: string
  label: string
  content: string
}

// An image picked in the composer. Unlike text attachments it uploads to the
// conversation immediately on selection; `name` is the stored (uniquified)
// file name, `label` the original one shown to the user.
type PendingImage = {
  id: string
  name: string
  label: string
  mediaType: string
  // Object URL of the picked file — instant previews with no server round-trip.
  previewUrl: string
  status: "uploading" | "ready" | "error"
}

// What a sent message carries per image: enough to build its file part.
export type AttachedImage = { name: string; mediaType: string }

// Pasting more than this many characters turns the clipboard text into a file
// attachment (a chip) instead of dumping it into the textarea.
const PASTE_AS_FILE_THRESHOLD = 5000

const MAX_IMAGES = 20

// The stored name keeps the original (sanitized) base for recognizability but
// always gets a unique suffix: a re-used name would overwrite the earlier
// upload and corrupt the message that references it.
function storedImageName(originalName: string, mediaType: string): string {
  const dot = originalName.lastIndexOf(".")
  const extension =
    dot > 0 && imageMediaTypeFor(originalName)
      ? originalName.slice(dot)
      : `.${Object.keys(IMAGE_MEDIA_TYPES).find((ext) => IMAGE_MEDIA_TYPES[ext] === mediaType) ?? "png"}`
  const base =
    (dot > 0 ? originalName.slice(0, dot) : originalName)
      // Exactly what the backend's isValidFileName rejects: separators + control chars.
      // eslint-disable-next-line no-control-regex
      .replace(/[/\\\u0000-\u001f]/g, "-")
      .trim() || "image"
  // 128-char backend name limit, minus room for the suffix and extension.
  return `${base.slice(0, 100)}-${randomUUID().slice(0, 8)}${extension}`
}

type ChatInputProps = {
  busy: boolean
  // Images upload as soon as they're picked, so the composer needs to know the
  // conversation they belong to (the client-generated id works before the row exists).
  conversationId: string
  // Whether the selected model takes image input; false hides the attach
  // button (unknown keeps it, the model may well support images).
  canAttachImages?: boolean
  // No model is selected (no override, no default) — sending is blocked until
  // the user picks one in the status bar or Settings → Models.
  noModel?: boolean
  // The turn is paused on an approval prompt: sending is blocked until the
  // user decides (typing is fine, the draft survives).
  approvalPending?: boolean
  onSend: (
    text: string,
    attachments: PendingAttachment[],
    images: AttachedImage[]
  ) => Promise<void> | void
  onStop: () => void
}

export function ChatInput({
  busy,
  conversationId,
  canAttachImages = true,
  noModel = false,
  approvalPending = false,
  onSend,
  onStop,
}: ChatInputProps) {
  const [value, setValue] = useState("")
  const [attachments, setAttachments] = useState<PendingAttachment[]>([])
  const [images, setImages] = useState<PendingImage[]>([])
  // True only while attachments upload, before the stream sets `busy`.
  const [sending, setSending] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const uploadsPending = images.some((i) => i.status === "uploading")
  const uploadsFailed = images.some((i) => i.status === "error")

  const canSend =
    (value.trim() !== "" || attachments.length > 0 || images.length > 0) &&
    !busy &&
    !sending &&
    !noModel &&
    !approvalPending &&
    !uploadsPending &&
    !uploadsFailed

  const submit = async () => {
    if (!canSend) return
    setSending(true)
    try {
      await onSend(
        value.trim(),
        attachments,
        images.map(({ name, mediaType }) => ({ name, mediaType }))
      )
      setValue("")
      setAttachments([])
      // Keep (don't revoke) the object URLs: the sent message renders its
      // images from this cache, avoiding a download-route fetch that races
      // the conversation row's creation on a first message.
      images.forEach((image) => cacheImagePreview(conversationId, image.name, image.previewUrl))
      setImages([])
    } catch {
      // onSend surfaces the failure (toast); keep the text and chips for retry.
    } finally {
      setSending(false)
    }
  }

  const addImages = (files: File[]) => {
    const room = MAX_IMAGES - images.length
    if (files.length > room) {
      toast.error(`Up to ${MAX_IMAGES} images per message`, {
        description: room > 0 ? `Only the first ${room} were attached.` : undefined,
      })
    }
    for (const file of files.slice(0, Math.max(room, 0))) {
      const mediaType = imageMediaTypeFor(file.name) ?? file.type
      if (!Object.values(IMAGE_MEDIA_TYPES).includes(mediaType)) {
        toast.error(`"${file.name}" is not a supported image`, {
          description: "Use PNG, JPEG, WebP, or GIF.",
        })
        continue
      }
      const image: PendingImage = {
        id: randomUUID(),
        name: storedImageName(file.name, mediaType),
        label: file.name,
        mediaType,
        previewUrl: URL.createObjectURL(file),
        status: "uploading",
      }
      setImages((prev) => [...prev, image])
      // Upload immediately; the message will only reference the stored name.
      uploadFile({ conversationId, name: image.name, content: file, contentType: mediaType })
        .then(() =>
          setImages((prev) =>
            prev.map((i) => (i.id === image.id ? { ...i, status: "ready" as const } : i))
          )
        )
        .catch((e) => {
          toast.error(`Failed to upload "${file.name}"`, {
            description: e instanceof Error ? e.message : undefined,
          })
          setImages((prev) =>
            prev.map((i) => (i.id === image.id ? { ...i, status: "error" as const } : i))
          )
        })
    }
  }

  const removeImage = (image: PendingImage) => {
    URL.revokeObjectURL(image.previewUrl)
    setImages((prev) => prev.filter((i) => i.id !== image.id))
    // Fire-and-forget: the upload may not have finished (or failed) — a miss is fine.
    if (image.status !== "error") {
      void deleteUploadedFile({ conversationId, name: image.name }).catch(() => {})
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
        {images.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {images.map((image) => (
              <div
                key={image.id}
                className={cn(
                  "group relative size-16 overflow-hidden rounded-md border",
                  image.status === "error" && "border-destructive"
                )}
              >
                <img
                  src={image.previewUrl}
                  alt={image.label}
                  title={image.label}
                  className={cn(
                    "size-full object-cover",
                    image.status !== "ready" && "opacity-50"
                  )}
                />
                {image.status === "uploading" && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Loader2 className="size-4 animate-spin text-foreground" />
                  </div>
                )}
                <button
                  type="button"
                  aria-label={`Remove ${image.label}`}
                  onClick={() => removeImage(image)}
                  className="absolute top-0.5 right-0.5 rounded-full bg-background/80 p-0.5 text-muted-foreground shadow-sm transition-colors hover:bg-background hover:text-foreground"
                >
                  <X className="size-3" />
                </button>
              </div>
            ))}
          </div>
        )}
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
          {canAttachImages && (
            <>
              <input
                ref={fileInputRef}
                type="file"
                accept={IMAGE_FILE_ACCEPT}
                multiple
                className="hidden"
                onChange={(e) => {
                  addImages(Array.from(e.target.files ?? []))
                  // Reset so picking the same file again re-fires the change event.
                  e.target.value = ""
                }}
              />
              <Tooltip delayDuration={300}>
                <TooltipTrigger asChild>
                  <Button
                    size="icon"
                    variant="outline"
                    aria-label="Attach images"
                    className="size-11"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Paperclip className="size-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top">Attach images</TooltipContent>
              </Tooltip>
            </>
          )}
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
        {noModel && (
          <p className="text-xs text-amber-600 dark:text-amber-500">
            No model selected — pick one in the status bar below or in Settings → Models to start chatting.
          </p>
        )}
        {approvalPending && (
          <p className="text-xs text-amber-600 dark:text-amber-500">
            The agent is waiting for your approval above — approve or deny to continue.
          </p>
        )}
        {uploadsFailed && (
          <p className="text-xs text-amber-600 dark:text-amber-500">
            An image failed to upload — remove it to send the message.
          </p>
        )}
      </div>
    </div>
  )
}
