import { useState } from "react"
import { Check, ChevronDown, ChevronsUpDown, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useProviders } from "@/hooks/use-providers"
import { testProvider, type ProviderConfig, type ProviderType } from "@/lib/api"
import { cn } from "@/lib/utils"

export type ModelSelection = { provider: ProviderType; model: string }

const PROVIDER_LABELS: Record<ProviderType, string> = {
  lmstudio: "LM Studio",
  anthropic: "Anthropic",
  google: "Google",
  deepinfra: "DeepInfra",
}

// Full-width provider → model dropdown. Configured providers expand to a
// live-fetched model list; picking one calls onChange, the clear item calls
// onChange(null). Shared by the Models and Agent settings model pickers.
export function ModelPicker({
  value,
  onChange,
  disabled,
  busy,
  emptyLabel = "Default model",
  clearLabel = "Use default model",
  menuLabel = "Model",
}: {
  value: ModelSelection | null
  onChange: (next: ModelSelection | null) => void
  disabled?: boolean
  busy?: boolean
  emptyLabel?: string
  clearLabel?: string
  menuLabel?: string
}) {
  const { providers } = useProviders()
  const [expanded, setExpanded] = useState<ProviderType | null>(null)
  // undefined = not fetched yet, "loading" = in flight, [] = fetched but empty.
  const [modelsByProvider, setModelsByProvider] = useState<
    Partial<Record<ProviderType, string[] | "loading">>
  >({})

  // A selection whose provider was removed falls back to the default
  // server-side; reflect that here instead of lying.
  const configured = value && providers.some((p) => p.provider === value.provider) ? value : null
  const label = configured
    ? `${PROVIDER_LABELS[configured.provider]} · ${configured.model}`
    : emptyLabel

  const toggleProvider = async (config: ProviderConfig) => {
    const provider = config.provider
    setExpanded((cur) => (cur === provider ? null : provider))
    if (modelsByProvider[provider] !== undefined) return
    setModelsByProvider((cur) => ({ ...cur, [provider]: "loading" }))
    // The stored API key is filled in server-side; LM Studio just needs its URL.
    const { models } = await testProvider(
      provider,
      provider === "lmstudio" ? { url: config.settings.url } : {}
    ).catch(() => ({ models: [] as string[] }))
    const sorted = [...models].sort((a, b) =>
      a.localeCompare(b, undefined, { sensitivity: "base" })
    )
    setModelsByProvider((cur) => ({ ...cur, [provider]: sorted }))
  }

  return (
    <DropdownMenu
      onOpenChange={(open) => {
        // Fresh model lists (LM Studio's change as models load) per menu open.
        if (open) {
          setExpanded(null)
          setModelsByProvider({})
        }
      }}
    >
      <DropdownMenuTrigger asChild disabled={disabled || busy}>
        <Button variant="outline" className="w-full justify-between gap-2 font-normal">
          <span className="truncate">{label}</span>
          {busy ? (
            <Loader2 className="size-4 shrink-0 animate-spin" />
          ) : (
            <ChevronsUpDown className="size-4 shrink-0 text-muted-foreground" />
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        <DropdownMenuLabel className="text-xs">{menuLabel}</DropdownMenuLabel>
        {providers.length === 0 && (
          <div className="px-2 py-1.5 text-xs text-muted-foreground">
            No providers configured — add one in Settings → Models.
          </div>
        )}
        {providers.map((config) => {
          const provider = config.provider
          const models = modelsByProvider[provider]
          const isExpanded = expanded === provider
          return (
            <div key={provider}>
              <DropdownMenuItem
                // Providers expand in place; only model clicks close the menu.
                onSelect={(e) => {
                  e.preventDefault()
                  void toggleProvider(config)
                }}
              >
                <ChevronDown
                  className={cn("size-3.5 transition-transform", !isExpanded && "-rotate-90")}
                />
                {PROVIDER_LABELS[provider]}
              </DropdownMenuItem>
              {isExpanded &&
                (models === "loading" || models === undefined ? (
                  <div className="flex items-center gap-2 py-1.5 pl-8 pr-2 text-xs text-muted-foreground">
                    <Loader2 className="size-3 animate-spin" />
                    Loading models…
                  </div>
                ) : models.length === 0 ? (
                  <div className="py-1.5 pl-8 pr-2 text-xs text-muted-foreground">
                    No models available.
                  </div>
                ) : (
                  models.map((model) => {
                    const isActive =
                      configured?.provider === provider && configured.model === model
                    return (
                      <DropdownMenuItem
                        key={model}
                        className="pl-8 text-xs"
                        onSelect={() => onChange({ provider, model })}
                      >
                        <span className="truncate">{model}</span>
                        {isActive && <Check className="ml-auto size-3.5 shrink-0" />}
                      </DropdownMenuItem>
                    )
                  })
                ))}
            </div>
          )
        })}
        <DropdownMenuSeparator />
        <DropdownMenuItem className="text-xs" onSelect={() => onChange(null)}>
          {clearLabel}
          {!configured && <Check className="ml-auto size-3.5 shrink-0" />}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
