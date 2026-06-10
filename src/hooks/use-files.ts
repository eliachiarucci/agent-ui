import { useCallback, useEffect, useState } from "react"
import { toast } from "sonner"
import { listFiles, type StoredFile } from "@/lib/api"

export function useFiles(active: boolean, agentId?: string) {
  const [files, setFiles] = useState<StoredFile[]>([])
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setFiles(await listFiles(agentId))
    } catch (error) {
      toast.error("Failed to load files", {
        description: error instanceof Error ? error.message : undefined,
      })
    } finally {
      setLoading(false)
    }
  }, [agentId])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional: fetch when the dialog opens
    if (active) void load()
  }, [active, load])

  return { files, loading }
}
