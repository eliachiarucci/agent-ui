import { Check, ChevronsUpDown, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { ModelMenuItems } from "@/components/model-menu"
import { modelLabel, type ModelSelection } from "@/lib/model-label"
import { useProviders } from "@/hooks/use-providers"

export type { ModelSelection }

// Full-width provider → model dropdown (ModelMenuItems); picking one calls
// onChange, the clear item calls onChange(null). Shared by the Models and Agent
// settings model pickers.
export function ModelPicker({
  value,
  onChange,
  disabled,
  busy,
  emptyLabel = "Default model",
  clearLabel = "Use default model",
  menuLabel = "Model",
  clearable = true,
}: {
  value: ModelSelection | null
  onChange: (next: ModelSelection | null) => void
  disabled?: boolean
  busy?: boolean
  emptyLabel?: string
  clearLabel?: string
  menuLabel?: string
  // When false, the "clear" item is hidden so a selection is mandatory.
  clearable?: boolean
}) {
  const { providers } = useProviders()
  // A selection whose provider was removed falls back to the default
  // server-side; reflect that here instead of lying.
  const configured = value && providers.some((p) => p.provider === value.provider) ? value : null
  const label = configured ? modelLabel(configured) : emptyLabel

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild disabled={disabled || busy}>
        <Button variant="outline" className="w-full min-w-0 justify-between gap-2 font-normal">
          <span className="truncate" title={label}>{label}</span>
          {busy ? (
            <Loader2 className="size-4 shrink-0 animate-spin" />
          ) : (
            <ChevronsUpDown className="size-4 shrink-0 text-muted-foreground" />
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-72">
        <DropdownMenuLabel className="text-xs">{menuLabel}</DropdownMenuLabel>
        <ModelMenuItems selected={configured} onSelect={onChange} />
        {clearable && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-xs" onSelect={() => onChange(null)}>
              {clearLabel}
              {!configured && <Check className="ml-auto size-3.5 shrink-0" />}
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
