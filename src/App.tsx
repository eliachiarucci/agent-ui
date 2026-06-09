import { useMemo, useState } from "react"
import { AppSidebar } from "@/components/app-sidebar"
import { ChatView } from "@/components/chat/chat-view"
import { MemoryDialog } from "@/components/memory/memory-dialog"
import { useConversations } from "@/hooks/use-conversations"
import { toUIMessages } from "@/lib/api"

export default function App() {
  const { conversations, loading, refresh, remove } = useConversations()
  // New chats get a client-generated id; the backend creates the row on first message.
  const [activeId, setActiveId] = useState<string>(() => crypto.randomUUID())
  const [memoriesOpen, setMemoriesOpen] = useState(false)

  const initialMessages = useMemo(() => {
    const conversation = conversations.find((c) => c.id === activeId)
    return conversation ? toUIMessages(conversation.messages) : []
  }, [conversations, activeId])

  const handleDelete = (id: string) => {
    void remove(id)
    if (id === activeId) setActiveId(crypto.randomUUID())
  }

  return (
    <div className="flex h-dvh overflow-hidden bg-background text-foreground">
      <AppSidebar
        conversations={conversations}
        loading={loading}
        activeId={activeId}
        onSelect={setActiveId}
        onNewChat={() => setActiveId(crypto.randomUUID())}
        onDelete={handleDelete}
        onOpenMemories={() => setMemoriesOpen(true)}
      />

      <main className="flex min-w-0 flex-1 flex-col">
        <ChatView
          key={activeId}
          conversationId={activeId}
          initialMessages={initialMessages}
          onConversationSettled={() => void refresh()}
        />
      </main>

      <MemoryDialog open={memoriesOpen} onOpenChange={setMemoriesOpen} />
    </div>
  )
}
