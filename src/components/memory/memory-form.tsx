import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { MEMORY_CATEGORIES, type MemoryCategory, type MemoryInput } from "@/lib/api"

type MemoryFormProps = {
  initial?: MemoryInput
  submitLabel: string
  onSubmit: (input: MemoryInput) => Promise<void>
}

export function MemoryForm({ initial, submitLabel, onSubmit }: MemoryFormProps) {
  const [content, setContent] = useState(initial?.content ?? "")
  const [category, setCategory] = useState<MemoryCategory>(initial?.category ?? "other")
  const [importance, setImportance] = useState(initial?.importance ?? 0.5)
  const [pinned, setPinned] = useState(initial?.pinned ?? false)
  const [saving, setSaving] = useState(false)

  const submit = async () => {
    if (!content.trim() || saving) return
    setSaving(true)
    try {
      await onSubmit({ content: content.trim(), category, importance, pinned })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-2">
        <Label htmlFor="memory-content">Memory</Label>
        <Textarea
          id="memory-content"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="e.g. Elia's favourite food is carbonara"
          rows={3}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="grid gap-2">
          <Label>Category</Label>
          <Select value={category} onValueChange={(v) => setCategory(v as MemoryCategory)}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MEMORY_CATEGORIES.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid gap-2">
          <Label>Importance: {importance.toFixed(2)}</Label>
          <Slider
            value={[importance]}
            onValueChange={([v]) => setImportance(v)}
            min={0}
            max={1}
            step={0.05}
          />
        </div>
      </div>

      <div className="flex items-center justify-between rounded-md border px-3 py-2">
        <div>
          <Label htmlFor="memory-pinned">Pinned</Label>
          <p className="text-xs text-muted-foreground">
            Pinned memories are included in every conversation.
          </p>
        </div>
        <Switch id="memory-pinned" checked={pinned} onCheckedChange={setPinned} />
      </div>

      <Button onClick={() => void submit()} disabled={!content.trim() || saving}>
        {saving ? "Saving…" : submitLabel}
      </Button>
    </div>
  )
}
