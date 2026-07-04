import { useState } from "react"
import { Ban, Check, ChevronDown, Loader2, ShieldQuestion } from "lucide-react"
import type { ToolUIPart, DynamicToolUIPart } from "ai"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { useApprovalActions } from "@/lib/approval-context"
import { cn } from "@/lib/utils"

// The "target" of a call, shown as chips and named in the "always approve"
// button — mirrors the backend's approval-target derivation (a standing
// approval covers exactly these values). Tools without an entry are approved
// tool-wide.
const APPROVAL_TARGETS: Record<string, (input: unknown) => string[]> = {
  create_draft: (input) => {
    const { to, cc, bcc } = (input ?? {}) as { to?: string[]; cc?: string[]; bcc?: string[] }
    return [...(to ?? []), ...(cc ?? []), ...(bcc ?? [])]
  },
}

function approvalTargets(toolName: string, input: unknown): string[] | null {
  return APPROVAL_TARGETS[toolName]?.(input) ?? null
}

/**
 * Reusable approval prompt for a paused "ask"-level tool call: shows what the
 * agent is trying to do (tool, targets, full input) and lets the user approve
 * it once, always approve this tool+target combination, or deny it. Rendered
 * by ToolPart when a tool part is in `approval-requested` state; the decision
 * goes through ApprovalContext (ChatView), which resumes the turn.
 */
export function ToolApprovalPrompt({
  part,
  toolName,
}: {
  part: ToolUIPart | DynamicToolUIPart
  toolName: string
}) {
  const [open, setOpen] = useState(false)
  const actions = useApprovalActions()

  if (part.state !== "approval-requested" && part.state !== "approval-responded") return null
  const approvalId = part.approval.id
  const targets = approvalTargets(toolName, part.input)

  // Already answered (locally or by the stored history) — the turn is resuming.
  if (part.state === "approval-responded") {
    return (
      <div className="flex items-center gap-2 rounded-lg border px-3 py-2 text-xs text-muted-foreground">
        {part.approval.approved ? (
          <>
            <Loader2 className="size-3.5 animate-spin" />
            Approved — running {toolName}…
          </>
        ) : (
          <>
            <Ban className="size-3.5" />
            Denied
          </>
        )}
      </div>
    )
  }

  const alwaysLabel =
    targets && targets.length > 0
      ? targets.length === 1
        ? `Always allow for ${targets[0]}`
        : "Always allow for these recipients"
      : `Always allow ${toolName}`

  return (
    <div className="rounded-lg border border-amber-500/40 bg-amber-500/5">
      <div className="flex items-start gap-2.5 p-3">
        <ShieldQuestion className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-500" />
        <div className="min-w-0 flex-1 space-y-1.5">
          <p className="text-sm font-medium">
            The agent wants to run <span className="font-mono text-xs">{toolName}</span>
          </p>
          {targets && targets.length > 0 && (
            <div className="flex flex-wrap items-center gap-1">
              {targets.map((target) => (
                <Badge key={target} variant="secondary" className="max-w-full">
                  <span className="truncate">{target}</span>
                </Badge>
              ))}
            </div>
          )}
          <Collapsible open={open} onOpenChange={setOpen}>
            <CollapsibleTrigger className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
              <ChevronDown className={cn("size-3 transition-transform", open && "rotate-180")} />
              {open ? "Hide details" : "Show details"}
            </CollapsibleTrigger>
            <CollapsibleContent>
              <pre className="mt-1.5 overflow-x-auto rounded-md bg-muted p-2 font-mono text-xs whitespace-pre-wrap">
                {JSON.stringify(part.input, null, 2)}
              </pre>
            </CollapsibleContent>
          </Collapsible>
        </div>
      </div>
      {actions ? (
        <div className="flex flex-wrap items-center gap-2 border-t border-amber-500/20 p-2.5">
          <Button size="sm" className="gap-1.5" onClick={() => actions.respond(approvalId, true)}>
            <Check className="size-3.5" />
            Approve
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5"
            onClick={() => actions.respond(approvalId, true, true)}
          >
            <Check className="size-3.5" />
            {alwaysLabel}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="gap-1.5 text-destructive hover:text-destructive"
            onClick={() => actions.respond(approvalId, false)}
          >
            <Ban className="size-3.5" />
            Deny
          </Button>
        </div>
      ) : (
        <p className="border-t border-amber-500/20 p-2.5 text-xs text-muted-foreground">
          Waiting for approval.
        </p>
      )}
    </div>
  )
}
