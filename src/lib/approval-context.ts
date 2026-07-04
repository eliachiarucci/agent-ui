import { createContext, useContext } from "react"

// Lets the approval prompt rendered inside a tool part answer a pending
// "ask"-level tool call without threading callbacks through MessageList/Message.
// `always` records a standing (tool, target) approval on top of approving.
export type ApprovalActions = {
  respond: (approvalId: string, approved: boolean, always?: boolean) => void
}

export const ApprovalContext = createContext<ApprovalActions | null>(null)

export function useApprovalActions(): ApprovalActions | null {
  return useContext(ApprovalContext)
}
