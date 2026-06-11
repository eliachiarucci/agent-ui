import { useState } from "react"
import { Download, Eye, FileText, FolderOpen, MessageSquare } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { FileContentPane } from "@/components/files/file-viewer"
import { useFiles } from "@/hooks/use-files"
import { fileDownloadUrl, type StoredFile } from "@/lib/api"

type FilesDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  agentId?: string
  // Jump to the conversation that produced a file; the caller closes this
  // dialog and switches the active chat.
  onOpenConversation: (conversationId: string) => void
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

// All of the agent's files (that the viewer can see) in one flat list — the
// per-conversation folders are a backend detail and stay hidden here.
export function FilesDialog({ open, onOpenChange, agentId, onOpenConversation }: FilesDialogProps) {
  const { files, loading } = useFiles(open, agentId)
  // File previewed in the nested dialog (stacked on top of this one).
  const [preview, setPreview] = useState<StoredFile | null>(null)

  const handleOpenChange = (next: boolean) => {
    if (!next) setPreview(null)
    onOpenChange(next)
  }

  return (
    <>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        {/* Fixed height so the dialog doesn't resize as the list loads. */}
        <DialogContent className="flex h-[min(85vh,44rem)] flex-col sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FolderOpen className="size-5" />
              Files
            </DialogTitle>
            <DialogDescription>
              Files the agent created in your conversations. View, download, or
              jump to the chat that made them.
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

              {!loading && files.length === 0 && (
                <p className="py-10 text-center text-sm text-muted-foreground">
                  No files yet. Ask the agent to write something down — a plan, a
                  document, some code — and it will show up here.
                </p>
              )}

              {!loading &&
                files.map((file) => (
                  <div
                    key={`${file.conversationId}/${file.name}`}
                    className="group flex items-center gap-3 rounded-md border px-3 py-2"
                  >
                    <FileText className="size-4 shrink-0 text-muted-foreground" />
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
                ))}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Preview popup, stacked on top of the files dialog (rendered later in
          the portal, so it sits above). */}
      <Dialog open={preview !== null} onOpenChange={(next) => !next && setPreview(null)}>
        <DialogContent className="flex h-[min(85vh,44rem)] flex-col sm:max-w-3xl">
          {preview && (
            <>
              <DialogHeader>
                <DialogTitle className="flex min-w-0 items-center gap-2">
                  <FileText className="size-4 shrink-0 text-muted-foreground" />
                  <span className="truncate">{preview.name}</span>
                </DialogTitle>
                <DialogDescription>
                  {formatSize(preview.size)} ·{" "}
                  {new Date(preview.updatedAt).toLocaleDateString()}
                </DialogDescription>
              </DialogHeader>
              <FileContentPane
                key={`${preview.conversationId}/${preview.name}`}
                conversationId={preview.conversationId}
                name={preview.name}
              />
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
