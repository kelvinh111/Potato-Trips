import { createOpenAI } from "@ai-sdk/openai";
import {
  generateObject,
  NoObjectGeneratedError,
} from "ai";
import { ZodError, type z } from "zod";

import { AiProviderError } from "@/lib/ai/errors";
import type {
  AiProvider,
  AiProviderMessage,
  AiStructuredGenerateInput,
  AiTokenUsage,
} from "@/lib/ai/types";

const DEFAULT_AI_MODEL = "gpt-5.6-terra";

interface OpenAiRuntimeConfig {
  model: string;
  apiKey: string;
}

export class OpenAiProviderAdapter implements AiProvider {
  async generateStructured<TSchema extends z.ZodTypeAny>(
    input: AiStructuredGenerateInput<TSchema>,
  ) {
    const config = getOpenAiRuntimeConfig();

    const prompt = input.prompt?.trim();
    const messages = normalizeMessages(input.messages);

    if (!prompt && messages.length === 0) {
      throw new AiProviderError({
        code: "PROVIDER_REQUEST_FAILURE",
        message: "AI request must include prompt or messages.",
      });
    }

    try {
      const openai = createOpenAI({ apiKey: config.apiKey });

      const result = await generateObject({
        model: openai(config.model),
        schema: input.outputSchema,
        system: input.systemInstructions,
        ...(messages.length > 0 ? { messages } : { prompt: prompt ?? "" }),
      });

      const parsedOutput = input.outputSchema.parse(result.object);

      return {
        output: parsedOutput,
        model: result.response?.modelId ?? config.model,
        usage: normalizeUsage(result.usage),
      };
    } catch (error) {
      if (error instanceof AiProviderError) {
        throw error;
      }

      if (error instanceof NoObjectGeneratedError || error instanceof ZodError) {
        throw new AiProviderError({
          code: "INVALID_STRUCTURED_OUTPUT",
          message: "AI returned invalid structured output.",
          cause: error,
        });
      }

      throw new AiProviderError({
        code: "PROVIDER_REQUEST_FAILURE",
        message: "AI request failed.",
        cause: error,
      });
    }
  }
}

function getOpenAiRuntimeConfig(): OpenAiRuntimeConfig {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  const model = process.env.AI_MODEL?.trim() || DEFAULT_AI_MODEL;

  if (!apiKey) {
    throw new AiProviderError({
      code: "CONFIGURATION_FAILURE",
      message: "OPENAI_API_KEY is not configured.",
    });
  }

  if (!model) {
    throw new AiProviderError({
      code: "CONFIGURATION_FAILURE",
      message: "AI_MODEL is not configured.",
    });
  }

  return {
    apiKey,
    model,
  };
}

function normalizeMessages(
  inputMessages: AiProviderMessage[] | undefined,
): Array<{ role: "user" | "assistant"; content: string }> {
  if (!inputMessages || inputMessages.length === 0) {
    return [];
  }

  return inputMessages
    .map((message) => {
      const content = message.content.trim();

      if (!content) {
        return null;
      }

      if (message.role === "assistant") {
        return {
          role: "assistant" as const,
          content,
        };
      }

      return {
        role: "user" as const,
        content,
      };
    })
    .filter((message): message is { role: "user" | "assistant"; content: string } => {
      return message !== null;
    });
}

function normalizeUsage(usage: {
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  promptTokens?: number;
  completionTokens?: number;
}): AiTokenUsage {
  const inputTokens =
    usage.inputTokens ?? usage.promptTokens ?? null;
  const outputTokens =
    usage.outputTokens ?? usage.completionTokens ?? null;
  const totalTokens =
    usage.totalTokens ??
    (inputTokens !== null && outputTokens !== null
      ? inputTokens + outputTokens
      : null);

  return {
    inputTokens,
    outputTokens,
    totalTokens,
  };
}
