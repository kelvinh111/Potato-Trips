import type { z } from "zod";

export interface AiProviderMessage {
  role: "user" | "assistant";
  content: string;
}

export interface AiStructuredGenerateInput<TSchema extends z.ZodTypeAny> {
  systemInstructions?: string;
  prompt?: string;
  messages?: AiProviderMessage[];
  outputSchema: TSchema;
}

export interface AiTokenUsage {
  inputTokens: number | null;
  outputTokens: number | null;
  totalTokens: number | null;
}

export interface AiStructuredGenerateResult<TSchema extends z.ZodTypeAny> {
  output: z.infer<TSchema>;
  model: string;
  usage: AiTokenUsage;
}

export interface AiProvider {
  generateStructured<TSchema extends z.ZodTypeAny>(
    input: AiStructuredGenerateInput<TSchema>,
  ): Promise<AiStructuredGenerateResult<TSchema>>;
}
