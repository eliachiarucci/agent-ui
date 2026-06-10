import { createContext, useContext } from "react"

// Lets deeply nested chat parts (the tool chips) open the file viewer without
// threading callbacks through MessageList/Message.
export type FileViewerActions = {
  viewFile: (name: string) => void
}

export const FileViewerContext = createContext<FileViewerActions | null>(null)

export function useFileViewerActions(): FileViewerActions | null {
  return useContext(FileViewerContext)
}
