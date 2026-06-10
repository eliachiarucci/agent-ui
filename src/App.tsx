import { useEffect, useMemo, useState } from "react"
import { PanelLeft, Sparkles } from "lucide-react"
import { AppSidebar } from "@/components/app-sidebar"
import { ChatView } from "@/components/chat/chat-view"
import { MemoryDialog } from "@/components/memory/memory-dialog"
import { SettingsDialog } from "@/components/settings-dialog"
import { LoginPage } from "@/components/auth/login-page"
import { Button } from "@/components/ui/button"
import { useAgents } from "@/hooks/use-agents"
import { useConversations } from "@/hooks/use-conversations"
import { useIsMobile } from "@/hooks/use-is-mobile"
import { toUIMessages } from "@/lib/api"
import { authClient } from "@/lib/auth-client"
import { discardChat, getChat, setChatOptions } from "@/lib/chat"

// Session gate: the workspace (and its data hooks) only mounts when signed in,
// and unmounts again when the session ends (sign-out, expiry).
export default function App() {
  const { data: session, isPending } = authClient.useSession()
  // The session refetches after every auth call (sign-in, 2FA, sign-out),
  // briefly flipping isPending. Only the very first load shows the splash;
  // otherwise the login page would unmount mid-flow and lose its state (e.g.
  // the TOTP step after a password sign-in).
  const [booted, setBooted] = useState(false)
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional: latch after first session resolution
    if (!isPending && !booted) setBooted(true)
  }, [isPending, booted])

  if (!booted) {
    return (
      <div className="flex h-dvh items-center justify-center bg-background">
        <Sparkles className="size-8 animate-pulse text-primary" />
      </div>
    )
  }

  if (!session) return <LoginPage />

  return <Workspace />
}

function Workspace() {
  const { agents, activeAgentId, selectAgent, create, update, remove: removeAgent } = useAgents()
  const { conversations, loading, refresh, remove } = useConversations(activeAgentId)
  // New chats get a client-generated id; the backend creates the row on first message.
  const [activeId, setActiveId] = useState<string>(() => crypto.randomUUID())
  // Private/shared choice for the next conversation; fixed server-side at creation.
  const [newChatShared, setNewChatShared] = useState(false)
  const [memoriesOpen, setMemoriesOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const isMobile = useIsMobile()
  const [sidebarOpen, setSidebarOpen] = useState(!isMobile)

  // Keep the sidebar in sync when the viewport crosses the mobile breakpoint.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional: reset on breakpoint change
    setSidebarOpen(!isMobile)
  }, [isMobile])

  // The transport reads these when a message is sent; the backend only honors
  // them when it creates the conversation row.
  useEffect(() => {
    setChatOptions(activeId, { agentId: activeAgentId, shared: newChatShared })
  }, [activeId, activeAgentId, newChatShared])

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
    setNewChatShared(false)
    if (isMobile) setSidebarOpen(false)
  }

  // Conversations and memories are per agent, so switching agents also starts a
  // fresh chat instead of carrying the open one across.
  const handleSelectAgent = (id: string) => {
    if (id === activeAgentId) return
    selectAgent(id)
    setActiveId(crypto.randomUUID())
    setNewChatShared(false)
  }

  // The hook already selects the new agent; start a fresh chat in it.
  const handleCreateAgent = async (name: string) => {
    const agent = await create(name)
    if (!agent) return false
    setActiveId(crypto.randomUUID())
    setNewChatShared(false)
    return true
  }

  // The hook switches to the first remaining agent; the open chat belonged to
  // the deleted agent, so start fresh.
  const handleDeleteAgent = async (id: string) => {
    const wasActive = id === activeAgentId
    const deleted = await removeAgent(id)
    if (deleted && wasActive) {
      discardChat(activeId)
      setActiveId(crypto.randomUUID())
      setNewChatShared(false)
    }
    return deleted
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
        agents={agents}
        activeAgentId={activeAgentId}
        onSelectAgent={handleSelectAgent}
        onSelect={handleSelect}
        onNewChat={() => handleSelect(crypto.randomUUID())}
        onDelete={handleDelete}
        onOpenMemories={() => setMemoriesOpen(true)}
        onOpenSettings={() => setSettingsOpen(true)}
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
        <ChatView
          key={activeId}
          chat={chat}
          shared={newChatShared}
          onSharedChange={setNewChatShared}
        />
      </main>

      <MemoryDialog open={memoriesOpen} onOpenChange={setMemoriesOpen} />
      <SettingsDialog
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        agents={agents}
        activeAgentId={activeAgentId}
        onSelectAgent={handleSelectAgent}
        onCreateAgent={handleCreateAgent}
        onUpdateAgent={update}
        onDeleteAgent={handleDeleteAgent}
      />
    </div>
  )
}
