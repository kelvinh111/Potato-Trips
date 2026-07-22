import { getAiProvider } from "@/lib/ai/provider";
import type { AiProviderMessage } from "@/lib/ai/types";
import {
  clarificationAiOutputSchema,
  isPlanningBriefReady,
  type ClarificationReadiness,
  type PlanningBrief,
  type PlanningSessionClarificationMessages,
} from "@/lib/planning-sessions/types";

const CLARIFICATION_SYSTEM_INSTRUCTIONS = `You are a travel planning assistant for a clarification-only phase.
Your job is to refine a planning brief from user messages before itinerary generation.
Rules:
- Use only information explicitly provided by the user.
- Never invent destinations, dates, budgets, traveler counts, or preferences.
- Readiness rule: return readiness READY when at least one destination is known and either trip duration OR an exact start/end date range is known.
- Optional preferences (budget, pace, style, interests, constraints) are useful but must not be required for READY.
- Ask concise follow-up questions only when needed.
- Ask at most 1 to 3 focused questions in one response.
- Avoid repeating questions already answered in prior messages.
- Do not generate itinerary content, day plans, activity lists, or recommendations.
- Keep assistantMessage short and practical.
- Return structured output only.`;

export interface GenerateClarificationTurnInput {
  initialPrompt: string;
  clarificationMessages: PlanningSessionClarificationMessages;
  planningBrief: PlanningBrief | null;
  replyMessage: string | null;
}

export interface GenerateClarificationTurnResult {
  assistantMessage: string;
  planningBrief: PlanningBrief;
  readiness: ClarificationReadiness;
}

export async function generateClarificationTurn(
  input: GenerateClarificationTurnInput,
): Promise<GenerateClarificationTurnResult> {
  const provider = getAiProvider();
  const messages = buildProviderMessages(input);

  const result = await provider.generateStructured({
    systemInstructions: CLARIFICATION_SYSTEM_INSTRUCTIONS,
    messages,
    outputSchema: clarificationAiOutputSchema,
  });

  const output = clarificationAiOutputSchema.parse(result.output);
  const readiness: ClarificationReadiness =
    output.readiness === "READY" && isPlanningBriefReady(output.planningBrief)
      ? "READY"
      : "NEEDS_CLARIFICATION";

  return {
    assistantMessage: output.assistantMessage,
    planningBrief: output.planningBrief,
    readiness,
  };
}

function buildProviderMessages(
  input: GenerateClarificationTurnInput,
): AiProviderMessage[] {
  const messages: AiProviderMessage[] = [
    {
      role: "user",
      content: input.initialPrompt,
    },
  ];

  if (input.planningBrief !== null) {
    messages.push({
      role: "assistant",
      content: `Current planning brief JSON: ${JSON.stringify(input.planningBrief)}`,
    });
  }

  messages.push(...input.clarificationMessages);

  if (input.replyMessage !== null) {
    messages.push({
      role: "user",
      content: input.replyMessage,
    });
  }

  return messages;
}
