import type { ProviderType } from "@/lib/api"

// A model choice. For OpenRouter the model id may name the provider that
// serves it: "anthropic/claude-haiku-5.5@google-vertex/europe".
export type ModelSelection = { provider: ProviderType; model: string }

export const PROVIDER_LABELS: Record<ProviderType, string> = {
  lmstudio: "LM Studio",
  anthropic: "Anthropic",
  google: "Google",
  deepinfra: "DeepInfra",
  tensorx: "TensorX",
  openrouter: "OpenRouter",
  openai: "OpenAI",
}

export function splitModel(id: string): { model: string; endpoint: string | null } {
  const at = id.indexOf("@")
  return at < 0 ? { model: id, endpoint: null } : { model: id.slice(0, at), endpoint: id.slice(at + 1) || null }
}

/** "OpenRouter · anthropic/claude-haiku-5.5 · google-vertex/europe" */
export function modelLabel(selection: ModelSelection): string {
  const { model, endpoint } = splitModel(selection.model)
  return [PROVIDER_LABELS[selection.provider], model, endpoint].filter(Boolean).join(" · ")
}
