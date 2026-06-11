import { useCallback, useEffect, useState } from "react"
import { toast } from "sonner"
import {
  createNote,
  deleteNote,
  listNotes,
  updateNote,
  type Note,
} from "@/lib/api"

// Loads when the dialog opens (like use-files) and mutates in place: each
// successful call patches the local list so the dialog never shows stale rows.
export function useNotes(active: boolean, agentId?: string) {
  const [notes, setNotes] = useState<Note[]>([])
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setNotes(await listNotes(agentId))
    } catch (error) {
      toast.error("Failed to load notes", {
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

  const create = useCallback(
    async (title: string, content: string): Promise<Note | null> => {
      try {
        const note = await createNote({ title, content, agentId })
        setNotes((current) => [note, ...current])
        return note
      } catch (error) {
        toast.error("Failed to create note", {
          description: error instanceof Error ? error.message : undefined,
        })
        return null
      }
    },
    [agentId]
  )

  const update = useCallback(
    async (
      id: string,
      changes: { title?: string; content?: string },
      // Autosave retries on its own and reports persistent failures itself;
      // a toast per attempt would spam.
      opts?: { silent?: boolean }
    ): Promise<Note | null> => {
      try {
        const note = await updateNote(id, changes, agentId)
        setNotes((current) => current.map((n) => (n.id === id ? note : n)))
        return note
      } catch (error) {
        if (!opts?.silent) {
          toast.error("Failed to save note", {
            description: error instanceof Error ? error.message : undefined,
          })
        }
        return null
      }
    },
    [agentId]
  )

  const remove = useCallback(
    async (id: string): Promise<boolean> => {
      try {
        await deleteNote(id, agentId)
        setNotes((current) => current.filter((n) => n.id !== id))
        return true
      } catch (error) {
        toast.error("Failed to delete note", {
          description: error instanceof Error ? error.message : undefined,
        })
        return false
      }
    },
    [agentId]
  )

  return { notes, loading, create, update, remove }
}
