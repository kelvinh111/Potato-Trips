import "server-only";

import { OpenAiProviderAdapter } from "@/lib/ai/openai-adapter";
import type { AiProvider } from "@/lib/ai/types";

let providerInstance: AiProvider | null = null;

export function getAiProviderRuntime(): AiProvider {
  if (!providerInstance) {
    providerInstance = new OpenAiProviderAdapter();
  }

  return providerInstance;
}
