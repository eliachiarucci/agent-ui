import { useState } from "react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { Download, FileText, Loader2, Maximize2, Minimize2, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useFileContent } from "@/hooks/use-file-content"
import { fileDownloadUrl } from "@/lib/api"
import { cn } from "@/lib/utils"

type FileViewerProps = {
  conversationId: string
  // Every file the chat's tool calls touched, in order of first appearance;
  // rendered as tabs when there is more than one.
  files: string[]
  activeFile: string
  onSelectFile: (name: string) => void
  // On mobile the viewer slides over the chat from the right instead of taking
  // layout space (mirrors the left sidebar).
  overlay: boolean
  onClose: () => void
}

function extensionOf(name: string): string {
  const dot = name.lastIndexOf(".")
  return dot === -1 ? "" : name.slice(dot + 1).toLowerCase()
}

// Same typography as chat markdown (text-part.tsx), sized up a touch for a
// document pane.
const MARKDOWN_CLASSES =
  "space-y-3 text-sm leading-relaxed [&_a]:underline [&_blockquote]:border-l-2 [&_blockquote]:pl-3 [&_blockquote]:text-muted-foreground [&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-[0.85em] [&_h1]:text-xl [&_h1]:font-semibold [&_h2]:text-lg [&_h2]:font-semibold [&_h3]:font-semibold [&_li]:my-0.5 [&_ol]:list-decimal [&_ol]:pl-5 [&_pre]:overflow-x-auto [&_pre]:rounded-md [&_pre]:bg-muted [&_pre]:p-3 [&_pre_code]:bg-transparent [&_pre_code]:p-0 [&_table]:w-full [&_table]:border-collapse [&_td]:border [&_td]:px-2 [&_td]:py-1 [&_th]:border [&_th]:bg-muted [&_th]:px-2 [&_th]:py-1 [&_ul]:list-disc [&_ul]:pl-5"

// One file's live content; remounted (keyed) per file so polling and scroll
// state start fresh when the tab changes.
function FileContentPane({ conversationId, name }: { conversationId: string; name: string }) {
  const { file, error, loading } = useFileContent(conversationId, name)
  const extension = extensionOf(name)
  const isHtml = extension === "html" || extension === "htm"

  return (
    // HTML owns the full pane (the iframe scrolls itself); everything else
    // scrolls in this container.
    <div className={cn("min-h-0 flex-1", !isHtml && "overflow-y-auto")}>
      {loading && (
        <div className="flex h-full items-center justify-center text-muted-foreground">
          <Loader2 className="size-5 animate-spin" />
        </div>
      )}
      {/* Transient poll errors keep showing the last good content. */}
      {!file && error && <p className="p-4 text-sm text-destructive">{error}</p>}
      {file &&
        (extension === "md" || extension === "markdown" ? (
          <div className={cn("p-4", MARKDOWN_CLASSES)}>
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{file.content}</ReactMarkdown>
          </div>
        ) : isHtml ? (
          // srcDoc + sandbox without allow-same-origin: the page renders fully
          // (scripts included) but in an opaque origin — no cookies, no app DOM.
          <iframe
            title={name}
            srcDoc={file.content}
            sandbox="allow-scripts"
            className="h-full w-full border-0 bg-white"
          />
        ) : (
          <pre className="overflow-x-auto p-4 font-mono text-xs leading-relaxed whitespace-pre-wrap">
            {file.content}
          </pre>
        ))}
    </div>
  )
}

export function FileViewer({
  conversationId,
  files,
  activeFile,
  onSelectFile,
  overlay,
  onClose,
}: FileViewerProps) {
  const [fullscreen, setFullscreen] = useState(false)

  return (
    <aside
      className={cn(
        "flex h-full flex-col border-l bg-background",
        fullscreen
          ? "fixed inset-0 z-50 w-auto border-l-0"
          : overlay
            ? "fixed inset-y-0 right-0 z-50 w-[min(85vw,28rem)] shadow-xl animate-in slide-in-from-right duration-200"
            : "w-104 shrink-0 xl:w-lg"
      )}
    >
      <div className="flex items-center gap-2 border-b px-3 py-2">
        <FileText className="size-4 shrink-0 text-muted-foreground" />
        <span className="min-w-0 flex-1 truncate text-sm font-medium" title={activeFile}>
          {activeFile}
        </span>
        <Button
          asChild
          variant="ghost"
          size="icon"
          aria-label={`Download ${activeFile}`}
          className="size-7"
        >
          <a href={fileDownloadUrl({ conversationId, name: activeFile })} download={activeFile}>
            <Download className="size-4" />
          </a>
        </Button>
        <Button
          variant="ghost"
          size="icon"
          aria-label={fullscreen ? "Exit full screen" : "Full screen"}
          className="size-7"
          onClick={() => setFullscreen((f) => !f)}
        >
          {fullscreen ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}
        </Button>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Close file viewer"
          className="size-7"
          onClick={onClose}
        >
          <X className="size-4" />
        </Button>
      </div>

      {files.length > 1 && (
        <div className="flex gap-1 overflow-x-auto border-b px-2 py-1.5">
          {files.map((name) => (
            <button
              key={name}
              onClick={() => onSelectFile(name)}
              className={cn(
                "max-w-44 shrink-0 truncate rounded-md px-2 py-1 text-xs transition-colors",
                name === activeFile
                  ? "bg-muted font-medium"
                  : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
              )}
            >
              {name}
            </button>
          ))}
        </div>
      )}

      <FileContentPane
        key={`${conversationId}/${activeFile}`}
        conversationId={conversationId}
        name={activeFile}
      />
    </aside>
  )
}
