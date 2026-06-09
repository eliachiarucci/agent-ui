import { Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"

const SUGGESTIONS = [
  "What do you remember about me?",
  "Remember that I prefer concise answers",
  "Help me plan my week",
]

export function EmptyState({ onSuggestion }: { onSuggestion: (text: string) => void }) {
  return (
    <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-6 px-4">
      <div className="flex size-14 items-center justify-center rounded-2xl bg-primary/10">
        <Sparkles className="size-7 text-primary" />
      </div>
      <div className="text-center">
        <h2 className="font-heading text-2xl font-semibold">How can I help you today?</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          I remember what matters to you across conversations.
        </p>
      </div>
      <div className="flex flex-wrap justify-center gap-2">
        {SUGGESTIONS.map((s) => (
          <Button key={s} variant="outline" size="sm" onClick={() => onSuggestion(s)}>
            {s}
          </Button>
        ))}
      </div>
    </div>
  )
}
