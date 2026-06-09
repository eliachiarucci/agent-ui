import { useState } from "react"
import { Brain, MessageSquare, Plus, Sparkles, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Skeleton } from "@/components/ui/skeleton"
import { Separator } from "@/components/ui/separator"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { ThemeToggle } from "@/components/theme-toggle"
import { conversationTitle, type Conversation } from "@/lib/api"
import { cn } from "@/lib/utils"

type AppSidebarProps = {
  conversations: Conversation[]
  loading: boolean
  activeId: string
  onSelect: (id: string) => void
  onNewChat: () => void
  onDelete: (id: string) => void
  onOpenMemories: () => void
}

export function AppSidebar({
  conversations,
  loading,
  activeId,
  onSelect,
  onNewChat,
  onDelete,
  onOpenMemories,
}: AppSidebarProps) {
  const [pendingDelete, setPendingDelete] = useState<Conversation | null>(null)

  return (
    <aside className="flex h-full w-72 shrink-0 flex-col border-r bg-sidebar text-sidebar-foreground">
      <div className="flex items-center gap-2 px-4 py-4">
        <Sparkles className="size-5 text-sidebar-primary" />
        <span className="font-heading text-lg font-semibold">Agent</span>
        <div className="ml-auto">
          <ThemeToggle />
        </div>
      </div>

      <div className="px-3">
        <Button className="w-full justify-start gap-2" onClick={onNewChat}>
          <Plus className="size-4" />
          New chat
        </Button>
      </div>

      <ScrollArea className="min-h-0 flex-1 px-3 py-3">
        <div className="flex flex-col gap-1">
          {loading &&
            Array.from({ length: 5 }, (_, i) => <Skeleton key={i} className="h-9 w-full" />)}

          {!loading && conversations.length === 0 && (
            <p className="px-2 py-6 text-center text-sm text-muted-foreground">
              No conversations yet.
              <br />
              Start a new chat!
            </p>
          )}

          {conversations.map((conversation) => (
            <div
              key={conversation.id}
              className={cn(
                "group flex items-center gap-1 rounded-md",
                conversation.id === activeId
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "hover:bg-sidebar-accent/60"
              )}
            >
              <button
                className="flex min-w-0 flex-1 items-center gap-2 px-2 py-2 text-left text-sm"
                onClick={() => onSelect(conversation.id)}
              >
                <MessageSquare className="size-4 shrink-0 text-muted-foreground" />
                <span className="truncate">{conversationTitle(conversation)}</span>
              </button>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Delete conversation"
                className="mr-1 size-7 shrink-0 opacity-0 transition-opacity group-hover:opacity-100"
                onClick={() => setPendingDelete(conversation)}
              >
                <Trash2 className="size-3.5" />
              </Button>
            </div>
          ))}
        </div>
      </ScrollArea>

      <Separator />
      <div className="p-3">
        <Button variant="outline" className="w-full justify-start gap-2" onClick={onOpenMemories}>
          <Brain className="size-4" />
          Memories
        </Button>
      </div>

      <AlertDialog open={pendingDelete !== null} onOpenChange={(open) => !open && setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete conversation?</AlertDialogTitle>
            <AlertDialogDescription>
              "{pendingDelete ? conversationTitle(pendingDelete) : ""}" will be permanently deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (pendingDelete) onDelete(pendingDelete.id)
                setPendingDelete(null)
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </aside>
  )
}
