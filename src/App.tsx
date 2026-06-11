import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useChat } from "@ai-sdk/react"
import { FileText, PanelLeft, Sparkles } from "lucide-react"
import { AppSidebar } from "@/components/app-sidebar"
import { ChatView } from "@/components/chat/chat-view"
import { MemoryDialog } from "@/components/memory/memory-dialog"
import { FilesDialog } from "@/components/files/files-dialog"
import { NotesDialog } from "@/components/notes/notes-dialog"
import { NoteEditorDialog } from "@/components/notes/note-editor-dialog"
import { RecurringJobsDialog } from "@/components/cron/recurring-jobs-dialog"
import { FileViewer } from "@/components/files/file-viewer"
import { SettingsDialog } from "@/components/settings-dialog"
import { LoginPage } from "@/components/auth/login-page"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import { useAgents } from "@/hooks/use-agents"
import { useNotes } from "@/hooks/use-notes"
import { useConversations } from "@/hooks/use-conversations"
import { useIsMobile } from "@/hooks/use-is-mobile"
import { getConversation, listNotes, toUIMessages, type Note } from "@/lib/api"
import { authClient } from "@/lib/auth-client"
import { discardChat, getChat, setChatOptions } from "@/lib/chat"
import { chatFileNames, latestPresentedFile } from "@/lib/chat-files"
import { FileViewerContext } from "@/lib/file-viewer-context"
import { randomUUID } from "@/lib/uuid"

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
  const { data: session } = authClient.useSession()
  const { agents, activeAgentId, selectAgent, create, update, remove: removeAgent } = useAgents()
  const { conversations, loading, refresh, add, remove } = useConversations(activeAgentId)
  // New chats get a client-generated id; the backend creates the row on first message.
  const [activeId, setActiveId] = useState<string>(() => randomUUID())
  // Private/shared choice for the next conversation; fixed server-side at creation.
  const [newChatShared, setNewChatShared] = useState(false)
  const [memoriesOpen, setMemoriesOpen] = useState(false)
  const [filesOpen, setFilesOpen] = useState(false)
  const [notesOpen, setNotesOpen] = useState(false)
  const [jobsOpen, setJobsOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const isMobile = useIsMobile()
  const [sidebarOpen, setSidebarOpen] = useState(!isMobile)

  // File viewer: which file (tab) is selected and whether the panel shows.
  // Open state is separate so closing the panel keeps the floating reopen
  // button available.
  const [activeFile, setActiveFile] = useState<string | null>(null)
  const [viewerOpen, setViewerOpen] = useState(false)
  // Last presentFile call already handled: re-renders and history re-scans
  // must not reopen a viewer the user closed.
  const handledPresentCall = useRef<string | null>(null)

  const resetViewer = () => {
    handledPresentCall.current = null
    setActiveFile(null)
    setViewerOpen(false)
  }

  // Tool-chip View buttons (via FileViewerContext) and presentFile auto-open
  // both land here.
  const viewFile = useCallback((name: string) => {
    setActiveFile(name)
    setViewerOpen(true)
  }, [])

  // Note opened from a chat tool chip — straight into the editor popup, no
  // notes list in between. Inactive useNotes only lends us its autosaving
  // update for the popup.
  const [chatNote, setChatNote] = useState<Note | null>(null)
  const { update: updateChatNote } = useNotes(false, activeAgentId)
  const viewNote = useCallback(
    (title: string) => {
      void (async () => {
        // Tool calls only carry the title; fetch the row (fresh content included).
        const notes = await listNotes(activeAgentId).catch(() => null)
        const note = notes?.find((n) => n.title === title)
        if (!note) {
          toast.error(notes ? `Note "${title}" no longer exists` : "Failed to load note")
          return
        }
        setChatNote(note)
      })()
    },
    [activeAgentId]
  )

  const fileViewerActions = useMemo(() => ({ viewFile, viewNote }), [viewFile, viewNote])

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

  // Second subscriber to the same Chat instance as ChatView: the workspace
  // derives the file-viewer state (tabs, presentFile auto-open) from the
  // live message stream.
  const { messages } = useChat({ chat })
  const chatFiles = useMemo(() => chatFileNames(messages), [messages])
  const latestPresented = useMemo(() => latestPresentedFile(messages), [messages])

  // Auto-open on the newest presentFile call — once per tool call, so a viewer
  // the user closed stays closed until the agent presents again. Also fires on
  // mount, restoring the last presented file when reopening a conversation.
  useEffect(() => {
    if (!latestPresented || handledPresentCall.current === latestPresented.toolCallId) return
    handledPresentCall.current = latestPresented.toolCallId
    viewFile(latestPresented.name)
  }, [latestPresented, viewFile])

  // The selected tab, falling back to the newest file when the selection
  // doesn't exist in this conversation.
  const viewedFile =
    activeFile && chatFiles.includes(activeFile) ? activeFile : chatFiles.at(-1)

  // Puts a brand-new conversation in the sidebar the moment its first message
  // is sent (the backend persists the row before streaming, so the id is
  // already real); existing conversations are deduped by the hook.
  const handleMessageSent = (text: string) => {
    if (!activeAgentId || conversations.some((c) => c.id === activeId)) return
    const now = new Date().toISOString()
    add({
      id: activeId,
      agentId: activeAgentId,
      userId: session?.user.id ?? "",
      shared: newChatShared,
      messages: [{ role: "user", content: text }],
      createdAt: now,
      updatedAt: now,
    })
  }

  const handleSelect = (id: string) => {
    setActiveId(id)
    setNewChatShared(false)
    resetViewer()
    if (isMobile) setSidebarOpen(false)
  }

  // Conversations and memories are per agent, so switching agents also starts a
  // fresh chat instead of carrying the open one across.
  const handleSelectAgent = (id: string) => {
    if (id === activeAgentId) return
    selectAgent(id)
    setActiveId(randomUUID())
    setNewChatShared(false)
    resetViewer()
  }

  // The hook already selects the new agent; start a fresh chat in it.
  const handleCreateAgent = async (name: string) => {
    const agent = await create(name)
    if (!agent) return false
    setActiveId(randomUUID())
    setNewChatShared(false)
    resetViewer()
    return true
  }

  // The hook switches to the first remaining agent; the open chat belonged to
  // the deleted agent, so start fresh.
  const handleDeleteAgent = async (id: string) => {
    const wasActive = id === activeAgentId
    const deleted = await removeAgent(id)
    if (deleted && wasActive) {
      discardChat(activeId)
      setActiveId(randomUUID())
      setNewChatShared(false)
      resetViewer()
    }
    return deleted
  }

  // Conversations created by recurring jobs are written server-side, so they
  // are usually not in the loaded sidebar list yet. Fetch the row and seed it
  // into the list *before* selecting: the Chat instance is cached on first
  // build (lib/chat.ts), so its messages must be there when activeId flips.
  const openJobConversation = async (id: string, agentId: string) => {
    setJobsOpen(false)
    const conversation = await getConversation(id)
    if (!conversation) return
    if (agentId !== activeAgentId) selectAgent(agentId)
    discardChat(id)
    add(conversation)
    handleSelect(id)
  }

  const handleDelete = (id: string) => {
    void remove(id)
    discardChat(id)
    if (id === activeId) {
      setActiveId(randomUUID())
      resetViewer()
    }
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
        onNewChat={() => handleSelect(randomUUID())}
        onDelete={handleDelete}
        onOpenMemories={() => setMemoriesOpen(true)}
        onOpenFiles={() => setFilesOpen(true)}
        onOpenNotes={() => setNotesOpen(true)}
        onOpenJobs={() => setJobsOpen(true)}
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
        {viewedFile && !viewerOpen && (
          <Button
            variant="outline"
            size="icon"
            aria-label="Open file viewer"
            className="absolute top-2 right-2 z-10 shadow-sm"
            onClick={() => setViewerOpen(true)}
          >
            <FileText className="size-4" />
          </Button>
        )}
        {/* Renderless provider: gives the tool chips inside the chat a way to
            open the file viewer. */}
        <FileViewerContext.Provider value={fileViewerActions}>
          <ChatView
            key={activeId}
            chat={chat}
            shared={newChatShared}
            onSharedChange={setNewChatShared}
            onMessageSent={handleMessageSent}
          />
        </FileViewerContext.Provider>
      </main>

      {isMobile && viewerOpen && viewedFile && (
        <div
          className="fixed inset-0 z-40 bg-black/50"
          aria-hidden
          onClick={() => setViewerOpen(false)}
        />
      )}
      {viewerOpen && viewedFile && (
        <FileViewer
          conversationId={activeId}
          files={chatFiles}
          activeFile={viewedFile}
          onSelectFile={setActiveFile}
          overlay={isMobile}
          onClose={() => setViewerOpen(false)}
        />
      )}

      <MemoryDialog open={memoriesOpen} onOpenChange={setMemoriesOpen} />
      <FilesDialog
        open={filesOpen}
        onOpenChange={setFilesOpen}
        agentId={activeAgentId}
        onOpenConversation={(id) => {
          setFilesOpen(false)
          handleSelect(id)
        }}
      />
      <NotesDialog open={notesOpen} onOpenChange={setNotesOpen} agentId={activeAgentId} />
      {/* Note editor opened from a chat tool chip's View button. */}
      <NoteEditorDialog
        note={chatNote}
        onOpenChange={(open) => !open && setChatNote(null)}
        onUpdate={updateChatNote}
      />
      <RecurringJobsDialog
        open={jobsOpen}
        onOpenChange={setJobsOpen}
        agents={agents}
        activeAgentId={activeAgentId}
        onOpenConversation={(id, agentId) => void openJobConversation(id, agentId)}
      />
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
