import { useEffect, useState } from "react"
import { getFileContent, type FileContent, type FileSource } from "@/lib/api"

const POLL_INTERVAL_MS = 2000

// Live view of one file: fetches immediately, then keeps polling so the viewer
// refreshes while the agent edits the file. State only changes when the file
// does (updatedAt/content compare), so polling doesn't cause re-renders.
// Callers remount the hook (React key) when the target file changes.
// `enabled: false` skips fetching entirely (binary files render via the
// download URL instead of the utf8 content route).
export function useFileContent(
  conversationId: string,
  name: string,
  options: { source?: FileSource; enabled?: boolean } = {}
) {
  const { source, enabled = true } = options
  const [file, setFile] = useState<FileContent | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!enabled) return
    let cancelled = false
    let timer: ReturnType<typeof setTimeout>

    const poll = async () => {
      try {
        const next = await getFileContent({ conversationId, name, source })
        if (cancelled) return
        setError(null)
        setFile((prev) =>
          prev && prev.updatedAt === next.updatedAt && prev.content === next.content
            ? prev
            : next
        )
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load file")
      } finally {
        if (!cancelled) timer = setTimeout(() => void poll(), POLL_INTERVAL_MS)
      }
    }

    void poll()
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [conversationId, name, source, enabled])

  return { file, error, loading: enabled && file === null && error === null }
}
