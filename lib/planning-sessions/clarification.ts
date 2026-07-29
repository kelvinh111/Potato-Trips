import { getAiProvider } from "@/lib/ai/provider";
import type { AiProviderMessage } from "@/lib/ai/types";
import { isDeepStrictEqual } from "node:util";
import {
  clarificationAiOutputSchema,
  isPlanningBriefReadyForConfirmation,
  normalizePlanningBrief,
  type ClarificationReadiness,
  type PlanningBrief,
  type PlanningSessionClarificationMessages,
} from "@/lib/planning-sessions/types";

const CLARIFICATION_SYSTEM_INSTRUCTIONS = `You are a friendly travel consultant in a clarification-only phase.
Your job is to refine a planning brief from user messages before itinerary generation.
Rules:
- Use only information explicitly provided by the user.
- Never invent destinations, dates, budgets, traveller counts, or preferences.
- Keep tone upbeat, warm, and concise. Sound natural and conversational, not like a form.
- assistantMessage may use safe Markdown for readability: short paragraphs, bold text, bullet/numbered lists, and line breaks.
- Required fields before ready: destination, starting location (city), travel timing (month+year minimum), trip length (1-14 days), travellers split (adults 12+ and children under 12), budget, interests/travel style, and practical feasibility.
- Destination scope judgment must be semantic and context-aware. Broad scopes (for example a whole country) are not automatically sufficient, especially for short or relaxed trips; ask what region(s) or city focus the user wants instead of inventing one.
- Ask related missing details together when practical.
- Ask concise follow-up questions only when needed.
- Ask at most 3 focused questions in one response.
- Avoid repeating questions already answered in prior messages.
- If plan is unrealistic or inconsistent, request adjustments and explain why.
- When a user gives a month without year, infer the next future occurrence relative to the provided server date context, unless conversation context clearly indicates a different year. Do not ask for year unless genuinely needed.
- Traveller inference: if user answers the travelling-party question with "solo", "a couple", "2 adults", or equivalent, treat it as the full group by default (adults 12+ as stated, children under 12 = 0) unless context is genuinely ambiguous.
- Once requirements are sufficient and practical, provide concise final planning summary and return readiness READY_FOR_CONFIRMATION.
- If user explicitly confirms generation in context and requirements remain sufficient, return readiness CONFIRMED.
- If user changes requirements while confirming, update planningBrief and return READY_FOR_CONFIRMATION again.
- Confirmation integrity rule (critical): when current clarification stage status is READY_TO_GENERATE and user only confirms without any requirement change, you must return readiness CONFIRMED and copy Current planning brief JSON exactly as planningBrief.
- Exact copy requirement includes every field and value, including nulls, arrays, array ordering, practicality notes, and finalSummary.
- In that pure-confirmation case, do not summarize, normalize, reword, reorder, derive, or otherwise alter any planningBrief value.
- If user requests any requirement change while confirming, update planningBrief accordingly and return readiness READY_FOR_CONFIRMATION.
- Do not generate itinerary content, day plans, activity lists, or recommendations.
- Keep assistantMessage concise.
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
  const outputPlanningBrief = normalizePlanningBrief(output.planningBrief);
  const persistedPlanningBrief =
    input.planningBrief === null ? null : normalizePlanningBrief(input.planningBrief);
  const hasRequiredBriefData = isPlanningBriefReadyForConfirmation(outputPlanningBrief);

  const isConfirmationAttempt =
    input.status === "READY_TO_GENERATE" && output.readiness === "CONFIRMED";
  const hasUnchangedRequirementsForConfirmation =
    isConfirmationAttempt &&
    persistedPlanningBrief !== null &&
    arePlanningBriefRequirementsEqual(persistedPlanningBrief, outputPlanningBrief);

  const readiness: ClarificationReadiness = !hasRequiredBriefData
    ? "NEEDS_CLARIFICATION"
    : hasUnchangedRequirementsForConfirmation
      ? "CONFIRMED"
      : "READY_FOR_CONFIRMATION";

  const assistantMessage =
    readiness === "CONFIRMED"
      ? CONFIRMED_COMPLETION_MESSAGE
      : output.assistantMessage;

  const persistedFinalSummary = persistedPlanningBrief?.finalSummary ?? null;
  const finalSummary =
    readiness === "READY_FOR_CONFIRMATION"
      ? output.assistantMessage
      : readiness === "CONFIRMED"
        ? persistedFinalSummary
        : null;

  const finalizedPlanningBrief: PlanningBrief =
    readiness === "CONFIRMED" && persistedPlanningBrief !== null
      ? {
          ...persistedPlanningBrief,
          finalSummary,
        }
      : {
          ...outputPlanningBrief,
          finalSummary,
        };

  return {
    assistantMessage,
    planningBrief: finalizedPlanningBrief,
    readiness,
    missingInformation: output.missingInformation,
  };
}

function arePlanningBriefRequirementsEqual(
  left: PlanningBrief,
  right: PlanningBrief,
): boolean {
  return isDeepStrictEqual(
    withoutFinalSummary(left),
    withoutFinalSummary(right),
  );
}

function withoutFinalSummary(brief: PlanningBrief): Omit<PlanningBrief, "finalSummary"> {
  return Object.fromEntries(
    Object.entries(brief).filter(([key]) => key !== "finalSummary"),
  ) as Omit<PlanningBrief, "finalSummary">;
}

function buildProviderMessages(
  input: GenerateClarificationTurnInput,
): AiProviderMessage[] {
  const now = new Date();
  const serverDateIso = now.toISOString().slice(0, 10);
  const serverDateTimeUtc = now.toISOString();

  const messages: AiProviderMessage[] = [
    {
      role: "user",
      content: input.initialPrompt,
    },
    {
      role: "assistant",
      content: `Server date context: today is ${serverDateIso} (UTC timestamp ${serverDateTimeUtc}). Use this when interpreting month-only timing.`,
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
