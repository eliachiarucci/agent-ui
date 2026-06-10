import { useContextWindow } from "@/hooks/use-context-window"
import { ModelSelector } from "@/components/chat/model-selector"
import type { AgentUIMessage, UsageMetadata } from "@/lib/api"
import { cn } from "@/lib/utils"

type StatusBarProps = {
  messages: AgentUIMessage[]
}

// The newest message with usage metadata reflects the current context size
// (each step's usage covers the full prompt of that request, see backend).
function latestUsage(messages: AgentUIMessage[]): NonNullable<UsageMetadata["usage"]> | null {
  for (let i = messages.length - 1; i >= 0; i--) {
    const usage = messages[i].metadata?.usage
    if (usage && (usage.totalTokens ?? usage.inputTokens) != null) return usage
  }
  return null
}

function formatTokens(n: number): string {
  return n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n)
}

// VSCode-style sub-bar at the very bottom of the chat: context usage on the
// left, model selector on the right.
export function StatusBar({ messages }: StatusBarProps) {
  const window = useContextWindow()
  const usage = latestUsage(messages)

  // Always rendered — an empty chat shows 0 used as a reminder of the window size.
  const used = usage ? (usage.totalTokens ?? (usage.inputTokens ?? 0) + (usage.outputTokens ?? 0)) : 0
  const max = window?.contextLength ?? null
  const ratio = max ? Math.min(used / max, 1) : null

  return (
    <footer className="flex h-6 shrink-0 items-center justify-between border-t bg-sidebar px-3 text-[11px] text-muted-foreground">
      <div className="flex items-center gap-2">
        {ratio !== null && (
          <div
            role="progressbar"
            aria-label="Context window usage"
            aria-valuenow={Math.round(ratio * 100)}
            className="h-1 w-24 overflow-hidden rounded-full bg-muted"
          >
            <div
              className={cn(
                "h-full rounded-full transition-[width] duration-500",
                ratio < 0.7 ? "bg-primary/50" : ratio < 0.9 ? "bg-amber-500" : "bg-destructive"
              )}
              style={{ width: `${ratio * 100}%` }}
            />
          </div>
        )}
        <span className="tabular-nums">
          {formatTokens(used)}
          {max !== null && ` / ${formatTokens(max)}`} tokens
          {ratio !== null && ` (${Math.round(ratio * 100)}%)`}
        </span>
      </div>
      <ModelSelector fallbackModel={window?.model} />
    </footer>
  )
}
