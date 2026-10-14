import { ChevronsUpDown } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { ModelMenuItems } from "@/components/model-menu"
import { modelLabel } from "@/lib/model-label"
import { useProviders } from "@/hooks/use-providers"
import { useDefaultModel } from "@/hooks/use-default-model"
import { setActiveModel, useActiveModel } from "@/lib/active-model"
import { cn } from "@/lib/utils"

// Status-bar model picker (ModelMenuItems: provider → model, and OpenRouter's
// provider for the model). Picking a model makes it the
// active override for subsequent chat requests; "Use default model" drops the
// override back to the account default. With no override and no default, no
// model is selected and the selector prompts the user to pick one.
export function ModelSelector() {
  const { providers } = useProviders()
  const active = useActiveModel()
  const { selected: defaultModel } = useDefaultModel()
  // A selection whose provider was removed in settings doesn't count. The model
  // the chat will actually use is the active override, else the account default;
  // with neither, nothing is selected and the user must pick one.
  const activeConfigured =
    active && providers.some((p) => p.provider === active.provider) ? active : null
  const defaultConfigured =
    defaultModel && providers.some((p) => p.provider === defaultModel.provider)
      ? defaultModel
      : null
  const effective = activeConfigured ?? defaultConfigured
  const hasModel = effective !== null
  const label = effective ? modelLabel(effective) : "Select a model"

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          "flex max-w-56 items-center gap-1 rounded px-1 text-[11px] outline-none data-[state=open]:text-foreground",
          hasModel
            ? "text-muted-foreground hover:text-foreground"
            : "font-medium text-amber-600 hover:text-amber-600 dark:text-amber-500"
        )}
      >
        <span className="truncate" title={label}>{label}</span>
        <ChevronsUpDown className="size-3 shrink-0" />
      </DropdownMenuTrigger>
      <DropdownMenuContent side="top" align="end" className="w-72">
        <DropdownMenuLabel className="text-xs">Model</DropdownMenuLabel>
        <ModelMenuItems selected={effective} onSelect={setActiveModel} />
        {activeConfigured && defaultConfigured && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-xs" onSelect={() => setActiveModel(null)}>
              Use default model
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
