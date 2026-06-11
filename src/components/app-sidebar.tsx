import { useState } from "react"
import { Brain, CalendarClock, FolderOpen, MessageSquare, PanelLeftClose, Plus, Settings, StickyNote, Trash2, Users } from "lucide-react"
import { Button } from "@/components/ui/button"
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
import { AgentSwitcher } from "@/components/agent-switcher"
import { conversationTitle, type Agent, type Conversation } from "@/lib/api"
import { cn } from "@/lib/utils"

type AppSidebarProps = {
  open: boolean
  // On mobile the sidebar floats over the chat instead of taking layout space.
  overlay: boolean
  onCollapse: () => void
  conversations: Conversation[]
  loading: boolean
  activeId: string
  agents: Agent[]
  activeAgentId?: string
  onSelectAgent: (id: string) => void
  onSelect: (id: string) => void
  onNewChat: () => void
  onDelete: (id: string) => void
  onOpenMemories: () => void
  onOpenFiles: () => void
  onOpenNotes: () => void
  onOpenJobs: () => void
  onOpenSettings: () => void
}

export function AppSidebar({
  open,
  overlay,
  onCollapse,
  conversations,
  loading,
  activeId,
  agents,
  activeAgentId,
  onSelectAgent,
  onSelect,
  onNewChat,
  onDelete,
  onOpenMemories,
  onOpenFiles,
  onOpenNotes,
  onOpenJobs,
  onOpenSettings,
}: AppSidebarProps) {
  const [pendingDelete, setPendingDelete] = useState<Conversation | null>(null)

  return (
    <aside
      className={cn(
        "flex h-full w-72 shrink-0 flex-col border-r bg-sidebar text-sidebar-foreground",
        overlay && "fixed inset-y-0 left-0 z-50",
        // Hidden (not unmounted) so the conversation list keeps its scroll position.
        !open && "hidden"
      )}
    >
      <div className="flex items-center gap-2 px-3 py-4">
        <AgentSwitcher
          agents={agents}
          activeAgentId={activeAgentId}
          onSelect={onSelectAgent}
          className="min-w-0 flex-1"
        />
        <div className="flex items-center gap-1">
          <ThemeToggle />
          <Button
            variant="ghost"
            size="icon"
            aria-label="Collapse sidebar"
            onClick={onCollapse}
          >
            <PanelLeftClose className="size-4" />
          </Button>
        </div>
      </div>

      <div className="px-3">
        <Button className="w-full justify-start gap-2" onClick={onNewChat}>
          <Plus className="size-4" />
          New chat
        </Button>
      </div>

      {/* Plain overflow div: Radix ScrollArea's display:table viewport lets rows grow
          wider than the sidebar, clipping the delete button and breaking truncation. */}
      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
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
                {conversation.shared ? (
                  <Users className="size-4 shrink-0 text-muted-foreground" aria-label="Shared conversation" />
                ) : (
                  <MessageSquare className="size-4 shrink-0 text-muted-foreground" />
                )}
                <span className="truncate">{conversationTitle(conversation)}</span>
              </button>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Delete conversation"
                className={cn(
                  "mr-1 size-7 shrink-0 transition-opacity hover:text-destructive",
                  conversation.id === activeId
                    ? "opacity-60 hover:opacity-100"
                    : "opacity-0 group-hover:opacity-60 group-hover:hover:opacity-100"
                )}
                onClick={() => setPendingDelete(conversation)}
              >
                <Trash2 className="size-3.5" />
              </Button>
            </div>
          ))}
        </div>
      </div>

      <Separator />
      <div className="flex flex-col gap-2 p-3">
        <div className="flex items-center gap-2">
          <Button variant="outline" className="flex-1 justify-start gap-2" onClick={onOpenJobs}>
            <CalendarClock className="size-4" />
            Jobs
          </Button>
          <Button variant="outline" className="flex-1 justify-start gap-2" onClick={onOpenNotes}>
            <StickyNote className="size-4" />
            Notes
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            aria-label="Open settings"
            onClick={onOpenSettings}
          >
            <Settings className="size-4" />
          </Button>
          <Button variant="outline" className="flex-1 justify-start gap-2" onClick={onOpenMemories}>
            <Brain className="size-4" />
            Memories
          </Button>
          <Button variant="outline" className="flex-1 justify-start gap-2" onClick={onOpenFiles}>
            <FolderOpen className="size-4" />
            Files
          </Button>
        </div>
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
