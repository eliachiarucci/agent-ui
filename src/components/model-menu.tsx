import { useState } from "react"
import { Check, ChevronDown, Loader2 } from "lucide-react"
import { DropdownMenuItem } from "@/components/ui/dropdown-menu"
import { useProviders } from "@/hooks/use-providers"
import {
  listProviderEndpoints,
  testProvider,
  type ModelProviderConfig,
  type ProviderEndpoint,
  type ProviderType,
} from "@/lib/api"
import { PROVIDER_LABELS, splitModel, type ModelSelection } from "@/lib/model-label"
import { cn } from "@/lib/utils"

// undefined = not fetched yet, "loading" = in flight, [] = fetched but empty.
type Loaded<T> = T[] | "loading" | undefined

// The provider → model list of a model menu, with OpenRouter models expanding
// to the providers (endpoints) that serve them. Configured providers expand in
// place to a live-fetched model list; only a final pick calls onSelect and
// closes the menu. Mounted with the menu's content, so every open starts fresh
// (LM Studio's list changes as models load).
export function ModelMenuItems({
  selected,
  onSelect,
}: {
  selected: ModelSelection | null
  onSelect: (selection: ModelSelection) => void
}) {
  const { providers } = useProviders()
  const [expanded, setExpanded] = useState<ProviderType | null>(null)
  const [modelsByProvider, setModelsByProvider] = useState<Partial<Record<ProviderType, Loaded<string>>>>({})
  const [expandedModel, setExpandedModel] = useState<string | null>(null)
  const [endpointsByModel, setEndpointsByModel] = useState<Record<string, Loaded<ProviderEndpoint> | "error">>({})

  const current = selected ? { provider: selected.provider, ...splitModel(selected.model) } : null

  const toggleProvider = async (config: ModelProviderConfig) => {
    const provider = config.provider
    setExpanded((cur) => (cur === provider ? null : provider))
    if (modelsByProvider[provider] !== undefined) return
    setModelsByProvider((cur) => ({ ...cur, [provider]: "loading" }))
    // The stored API key is filled in server-side; LM Studio just needs its URL.
    const { models } = await testProvider(
      provider,
      provider === "lmstudio" ? { url: config.settings.url } : {}
    ).catch(() => ({ models: [] as string[] }))
    const sorted = [...models].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }))
    setModelsByProvider((cur) => ({ ...cur, [provider]: sorted }))
  }

  const toggleModel = async (model: string) => {
    setExpandedModel((cur) => (cur === model ? null : model))
    if (endpointsByModel[model] !== undefined) return
    setEndpointsByModel((cur) => ({ ...cur, [model]: "loading" }))
    const result = await listProviderEndpoints(model)
      .then(({ endpoints }) => endpoints)
      .catch(() => "error" as const)
    setEndpointsByModel((cur) => ({ ...cur, [model]: result }))
  }

  if (providers.length === 0) {
    return (
      <div className="px-2 py-1.5 text-xs text-muted-foreground">
        No providers configured — add one in Settings → Models.
      </div>
    )
  }

  return providers.map((config) => {
    const provider = config.provider
    const models = modelsByProvider[provider]
    const isExpanded = expanded === provider
    return (
      <div key={provider}>
        <DropdownMenuItem
          onSelect={(e) => {
            e.preventDefault()
            void toggleProvider(config)
          }}
        >
          <ChevronDown className={cn("size-3.5 transition-transform", !isExpanded && "-rotate-90")} />
          {PROVIDER_LABELS[provider]}
        </DropdownMenuItem>
        {isExpanded &&
          (models === "loading" || models === undefined ? (
            <Note indent="pl-8" loading>
              Loading models…
            </Note>
          ) : models.length === 0 ? (
            <Note indent="pl-8">No models available.</Note>
          ) : (
            models.map((model) => {
              const isCurrent = current?.provider === provider && current.model === model
              if (provider !== "openrouter") {
                return (
                  <DropdownMenuItem key={model} className="pl-8 text-xs" onSelect={() => onSelect({ provider, model })}>
                    <span className="truncate">{model}</span>
                    {isCurrent && <Check className="ml-auto size-3.5 shrink-0" />}
                  </DropdownMenuItem>
                )
              }
              const isOpen = expandedModel === model
              const endpoints = endpointsByModel[model]
              return (
                <div key={model}>
                  <DropdownMenuItem
                    className="pl-8 text-xs"
                    onSelect={(e) => {
                      e.preventDefault()
                      void toggleModel(model)
                    }}
                  >
                    <ChevronDown className={cn("size-3 shrink-0 transition-transform", !isOpen && "-rotate-90")} />
                    <span className="truncate">{model}</span>
                    {isCurrent && <Check className="ml-auto size-3.5 shrink-0" />}
                  </DropdownMenuItem>
                  {isOpen && (
                    <>
                      <DropdownMenuItem className="pl-14 text-xs" onSelect={() => onSelect({ provider, model })}>
                        <span className="truncate">Any provider</span>
                        {isCurrent && current?.endpoint === null && <Check className="ml-auto size-3.5 shrink-0" />}
                      </DropdownMenuItem>
                      {endpoints === "loading" || endpoints === undefined ? (
                        <Note indent="pl-14" loading>
                          Loading providers…
                        </Note>
                      ) : endpoints === "error" ? (
                        <Note indent="pl-14">Couldn&apos;t load the providers.</Note>
                      ) : (
                        endpoints.map((endpoint) => (
                          <DropdownMenuItem
                            key={endpoint.tag}
                            className="pl-14 text-xs"
                            onSelect={() => onSelect({ provider, model: `${model}@${endpoint.tag}` })}
                          >
                            <span className="truncate">{endpoint.tag}</span>
                            {endpoint.status !== null && endpoint.status < 0 && (
                              <span className="shrink-0 text-muted-foreground">down</span>
                            )}
                            {isCurrent && current?.endpoint === endpoint.tag && (
                              <Check className="ml-auto size-3.5 shrink-0" />
                            )}
                          </DropdownMenuItem>
                        ))
                      )}
                    </>
                  )}
                </div>
              )
            })
          ))}
      </div>
    )
  })
}

function Note({ indent, loading, children }: { indent: string; loading?: boolean; children: React.ReactNode }) {
  return (
    <div className={cn("flex items-center gap-2 py-1.5 pr-2 text-xs text-muted-foreground", indent)}>
      {loading && <Loader2 className="size-3 animate-spin" />}
      {children}
    </div>
  )
}
