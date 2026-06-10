import { useEffect, useMemo, useState } from "react"
import { PanelLeft } from "lucide-react"
import { AppSidebar } from "@/components/app-sidebar"
import { ChatView } from "@/components/chat/chat-view"
import { MemoryDialog } from "@/components/memory/memory-dialog"
import { Button } from "@/components/ui/button"
import { useConversations } from "@/hooks/use-conversations"
import { useIsMobile } from "@/hooks/use-is-mobile"
import { toUIMessages } from "@/lib/api"
import { discardChat, getChat } from "@/lib/chat"

export default function App() {
  const { conversations, loading, refresh, remove } = useConversations()
  // New chats get a client-generated id; the backend creates the row on first message.
  const [activeId, setActiveId] = useState<string>(() => crypto.randomUUID())
  const [memoriesOpen, setMemoriesOpen] = useState(false)
  const isMobile = useIsMobile()
  const [sidebarOpen, setSidebarOpen] = useState(!isMobile)

  // Keep the sidebar in sync when the viewport crosses the mobile breakpoint.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional: reset on breakpoint change
    setSidebarOpen(!isMobile)
  }, [isMobile])

  // Cached per conversation in lib/chat.ts; switching chats swaps which cached
  // instance is rendered without interrupting an in-flight stream.
  const chat = useMemo(() => {
    const conversation = conversations.find((c) => c.id === activeId)
    return getChat(
      activeId,
      conversation ? toUIMessages(conversation.messages) : [],
      () => void refresh()
    )
  }, [activeId, conversations, refresh])

  const handleSelect = (id: string) => {
    setActiveId(id)
    if (isMobile) setSidebarOpen(false)
  }

  const handleDelete = (id: string) => {
    void remove(id)
    discardChat(id)
    if (id === activeId) setActiveId(crypto.randomUUID())
  }

  return (
    <div className="flex h-dvh overflow-hidden bg-background text-foreground">
      {isMobile && sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50"
          aria-hidden
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <AppSidebar
        open={sidebarOpen}
        overlay={isMobile}
        onCollapse={() => setSidebarOpen(false)}
        conversations={conversations}
        loading={loading}
        activeId={activeId}
        onSelect={handleSelect}
        onNewChat={() => handleSelect(crypto.randomUUID())}
        onDelete={handleDelete}
        onOpenMemories={() => setMemoriesOpen(true)}
      />

      <main className="relative flex min-w-0 flex-1 flex-col">
        {!sidebarOpen && (
          <Button
            variant="ghost"
            size="icon"
            aria-label="Open sidebar"
            className="absolute left-2 top-2 z-10"
            onClick={() => setSidebarOpen(true)}
          >
            <PanelLeft className="size-4" />
          </Button>
        )}
        <ChatView key={activeId} chat={chat} />
      </main>

      <MemoryDialog open={memoriesOpen} onOpenChange={setMemoriesOpen} />
    </div>
  )
}
