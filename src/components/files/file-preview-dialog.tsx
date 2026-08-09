import { Download, FileText, Image as ImageIcon, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { FileContentPane } from "@/components/files/file-viewer"
import { fileDownloadUrl, imageMediaTypeFor, type FileSource } from "@/lib/api"
import { formatSize } from "@/lib/utils"

// What the popup needs to show a file. Size/date are optional: the files
// dialog has them from the listing, a chat message only knows the name.
export type PreviewFile = {
  conversationId: string
  name: string
  source?: FileSource
  size?: number
  updatedAt?: string
}

// The file preview popup: used by the files dialog's Eye button (stacked on
// top of it) and by clicking an image attachment in the chat.
export function FilePreviewDialog({
  file,
  onClose,
}: {
  file: PreviewFile | null
  onClose: () => void
}) {
  return (
    <Dialog open={file !== null} onOpenChange={(next) => !next && onClose()}>
      {/* The default close button overlays the content's top-right corner —
          on top of long file names — so it's replaced by inline header buttons. */}
      <DialogContent showCloseButton={false} className="flex h-[min(85vh,44rem)] flex-col sm:max-w-3xl">
        {file && (
          <>
            <DialogHeader>
              <div className="flex items-center gap-1">
                <DialogTitle className="flex min-w-0 flex-1 items-center gap-2">
                  {imageMediaTypeFor(file.name) ? (
                    <ImageIcon className="size-4 shrink-0 text-muted-foreground" />
                  ) : (
                    <FileText className="size-4 shrink-0 text-muted-foreground" />
                  )}
                  <span className="truncate">{file.name}</span>
                </DialogTitle>
                <Button
                  asChild
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Download ${file.name}`}
                  className="-my-1.5 shrink-0"
                >
                  <a href={fileDownloadUrl(file)} download={file.name}>
                    <Download className="size-4" />
                  </a>
                </Button>
                <DialogClose asChild>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Close"
                    className="-my-1.5 shrink-0"
                  >
                    <X className="size-4" />
                  </Button>
                </DialogClose>
              </div>
              <DialogDescription>
                {file.size !== undefined && file.updatedAt !== undefined
                  ? `${formatSize(file.size)} · ${new Date(file.updatedAt).toLocaleDateString()}`
                  : file.source === "upload"
                    ? "Uploaded file"
                    : "Agent file"}
              </DialogDescription>
            </DialogHeader>
            <FileContentPane
              key={`${file.conversationId}/${file.source ?? "agent"}/${file.name}`}
              conversationId={file.conversationId}
              name={file.name}
              source={file.source}
            />
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
