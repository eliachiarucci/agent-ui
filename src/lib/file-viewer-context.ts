import { createContext, useContext } from "react"

// Lets deeply nested chat parts (the tool chips) open the file viewer — or the
// note editor popup — without threading callbacks through MessageList/Message.
export type FileViewerActions = {
  viewFile: (name: string) => void
  // Opens the agent-wide note with this title straight in the editor popup.
  viewNote: (title: string) => void
}

export const FileViewerContext = createContext<FileViewerActions | null>(null)

export function useFileViewerActions(): FileViewerActions | null {
  return useContext(FileViewerContext)
}
