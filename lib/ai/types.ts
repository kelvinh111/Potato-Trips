import type { z } from "zod";

export interface AiProviderMessage {
  role: "user" | "assistant";
  content: string;
}

type PromptInput = {
  prompt: string;
  messages?: never;
};

type MessagesInput = {
  messages: AiProviderMessage[];
  prompt?: never;
};

export type AiStructuredGenerateInput<TSchema extends z.ZodTypeAny> = {
  systemInstructions?: string;
  outputSchema: TSchema;
} & (PromptInput | MessagesInput);

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
