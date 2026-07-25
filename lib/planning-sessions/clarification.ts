import { getAiProvider } from "@/lib/ai/provider";
import type { AiProviderMessage } from "@/lib/ai/types";
import {
  clarificationAiOutputSchema,
  isPlanningBriefReadyForConfirmation,
  normalizePlanningBrief,
  type ClarificationReadiness,
  type PlanningBrief,
  type PlanningSessionClarificationMessages,
} from "@/lib/planning-sessions/types";

const CLARIFICATION_SYSTEM_INSTRUCTIONS = `You are a travel planning assistant for a clarification-only phase.
Your job is to refine a planning brief from user messages before itinerary generation.
Rules:
- Use only information explicitly provided by the user.
- Never invent destinations, dates, budgets, traveler counts, or preferences.
- Required fields before ready: destination, starting location (city), travel timing (month+year minimum), trip length (1-14 days), travellers split (adults 12+ and children under 12), budget, interests/travel style, and practical feasibility.
- Ask related missing details together when practical.
- Ask concise follow-up questions only when needed.
- Ask at most 3 focused questions in one response.
- Avoid repeating questions already answered in prior messages.
- If plan is unrealistic or inconsistent, request adjustments and explain why.
- Once requirements are sufficient and practical, provide concise final planning summary and return readiness READY_FOR_CONFIRMATION.
- If user explicitly confirms generation in context and requirements remain sufficient, return readiness CONFIRMED.
- If user changes requirements while confirming, update planningBrief and return READY_FOR_CONFIRMATION again.
- Do not generate itinerary content, day plans, activity lists, or recommendations.
- Keep assistantMessage short and practical.
- Return structured output only.`;

export interface GenerateClarificationTurnInput {
  initialPrompt: string;
  clarificationMessages: PlanningSessionClarificationMessages;
  planningBrief: PlanningBrief | null;
  replyMessage: string | null;
  status: "CLARIFYING" | "READY_TO_GENERATE";
}

export interface GenerateClarificationTurnResult {
  assistantMessage: string;
  planningBrief: PlanningBrief;
  readiness: ClarificationReadiness;
  missingInformation: string[];
}

const CONFIRMED_COMPLETION_MESSAGE =
  "Great, starting your itinerary generation now.";

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
  const planningBrief = normalizePlanningBrief(output.planningBrief);
  const hasRequiredBriefData = isPlanningBriefReadyForConfirmation(planningBrief);

  const readiness: ClarificationReadiness = hasRequiredBriefData
    ? output.readiness === "CONFIRMED"
      ? "CONFIRMED"
      : "READY_FOR_CONFIRMATION"
    : "NEEDS_CLARIFICATION";

  const assistantMessage =
    readiness === "CONFIRMED"
      ? CONFIRMED_COMPLETION_MESSAGE
      : output.assistantMessage;

  const finalizedPlanningBrief: PlanningBrief = {
    ...planningBrief,
    finalSummary:
      readiness === "READY_FOR_CONFIRMATION" || readiness === "CONFIRMED"
        ? output.assistantMessage
        : planningBrief.finalSummary,
  };

  return {
    assistantMessage,
    planningBrief: finalizedPlanningBrief,
    readiness,
    missingInformation: output.missingInformation,
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
    {
      role: "assistant",
      content: `Current clarification stage status: ${input.status}`,
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
