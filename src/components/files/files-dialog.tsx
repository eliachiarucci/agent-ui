import { useState } from "react"
import {
  ArrowLeft,
  Bot,
  ChevronRight,
  Download,
  Eye,
  FileText,
  Folder,
  FolderOpen,
  MessageSquare,
  Upload,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { FilePreviewDialog } from "@/components/files/file-preview-dialog"
import { useFiles } from "@/hooks/use-files"
import { cachedImagePreview } from "@/lib/image-previews"
import { formatSize } from "@/lib/utils"
import { fileDownloadUrl, imageMediaTypeFor, type FileSource, type StoredFile } from "@/lib/api"

type FilesDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  agentId?: string
  // Jump to the conversation that produced a file; the caller closes this
  // dialog and switches the active chat.
  onOpenConversation: (conversationId: string) => void
}

const FOLDERS: Array<{
  source: FileSource
  label: string
  description: string
  icon: typeof Bot
}> = [
  {
    source: "agent",
    label: "Agent files",
    description: "Documents, plans, and code the agent wrote",
    icon: Bot,
  },
  {
    source: "upload",
    label: "Uploaded files",
    description: "Images and files you attached in chats",
    icon: Upload,
  },
]

// Two folders — files the agent generated and files users uploaded — each
// holding a flat list across every conversation the viewer can see (the
// per-conversation folders on disk stay a backend detail).
export function FilesDialog({ open, onOpenChange, agentId, onOpenConversation }: FilesDialogProps) {
  const { files, loading } = useFiles(open, agentId)
  const [folder, setFolder] = useState<FileSource | null>(null)
  // File previewed in the nested dialog (stacked on top of this one).
  const [preview, setPreview] = useState<StoredFile | null>(null)

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      setPreview(null)
      setFolder(null)
    }
    onOpenChange(next)
  }

  const activeFolder = FOLDERS.find((f) => f.source === folder)
  const shown = folder ? files.filter((file) => file.source === folder) : []

  return (
    <>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        {/* Fixed height so the dialog doesn't resize as the list loads. */}
        <DialogContent className="flex h-[min(85vh,44rem)] flex-col sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {activeFolder ? (
                <>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Back to folders"
                    className="-ml-1 size-7"
                    onClick={() => setFolder(null)}
                  >
                    <ArrowLeft className="size-4" />
                  </Button>
                  {activeFolder.label}
                </>
              ) : (
                <>
                  <FolderOpen className="size-5" />
                  Files
                </>
              )}
            </DialogTitle>
            <DialogDescription>
              {activeFolder
                ? `${activeFolder.description}. View, download, or jump to the chat they belong to.`
                : "Files from your conversations: what the agent created and what you uploaded."}
            </DialogDescription>
          </DialogHeader>

          {/* Plain overflow div: Radix ScrollArea's display:table viewport doesn't
              constrain height inside the flex dialog, so it never scrolls. */}
          <div className="min-h-0 flex-1 overflow-y-auto pr-1">
            <div className="flex flex-col gap-1 py-1">
              {loading && (
                <div className="flex flex-col gap-2">
                  {Array.from({ length: 4 }, (_, i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              )}

              {!loading &&
                !folder &&
                FOLDERS.map(({ source, label, description, icon: Icon }) => {
                  const count = files.filter((file) => file.source === source).length
                  return (
                    <button
                      key={source}
                      type="button"
                      onClick={() => setFolder(source)}
                      className="group flex items-center gap-3 rounded-md border px-3 py-3 text-left transition-colors hover:bg-muted/60"
                    >
                      <Folder className="size-5 shrink-0 text-muted-foreground" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{label}</p>
                        <p className="truncate text-xs text-muted-foreground">{description}</p>
                      </div>
                      <span className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
                        <Icon className="size-3.5" />
                        {count} {count === 1 ? "file" : "files"}
                        <ChevronRight className="size-4 opacity-60 transition-transform group-hover:translate-x-0.5" />
                      </span>
                    </button>
                  )
                })}

              {!loading && folder && shown.length === 0 && (
                <p className="py-10 text-center text-sm text-muted-foreground">
                  {folder === "agent"
                    ? "No files yet. Ask the agent to write something down — a plan, a document, some code — and it will show up here."
                    : "Nothing uploaded yet. Attach images or paste long text in a chat and it will show up here."}
                </p>
              )}

              {!loading &&
                folder &&
                shown.map((file) => {
                  const isImage = imageMediaTypeFor(file.name) !== null
                  return (
                    <div
                      key={`${file.conversationId}/${file.source}/${file.name}`}
                      className="group flex items-center gap-3 rounded-md border px-3 py-2"
                    >
                      {isImage ? (
                        <img
                          src={
                            cachedImagePreview(file.conversationId, file.name) ??
                            fileDownloadUrl(file)
                          }
                          alt=""
                          loading="lazy"
                          className="size-9 shrink-0 rounded-md border object-cover"
                        />
                      ) : (
                        <FileText className="size-4 shrink-0 text-muted-foreground" />
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{file.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatSize(file.size)} · {new Date(file.updatedAt).toLocaleDateString()}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`View ${file.name}`}
                        className="shrink-0 opacity-60 hover:opacity-100"
                        onClick={() => setPreview(file)}
                      >
                        <Eye className="size-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Open chat for ${file.name}`}
                        className="shrink-0 opacity-60 hover:opacity-100"
                        onClick={() => onOpenConversation(file.conversationId)}
                      >
                        <MessageSquare className="size-4" />
                      </Button>
                      <Button
                        asChild
                        variant="ghost"
                        size="icon"
                        aria-label={`Download ${file.name}`}
                        className="shrink-0 opacity-60 hover:opacity-100"
                      >
                        <a href={fileDownloadUrl(file)} download={file.name}>
                          <Download className="size-4" />
                        </a>
                      </Button>
                    </div>
                  )
                })}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Preview popup, stacked on top of the files dialog (rendered later in
          the portal, so it sits above). */}
      <FilePreviewDialog file={preview} onClose={() => setPreview(null)} />
    </>
  )
}
