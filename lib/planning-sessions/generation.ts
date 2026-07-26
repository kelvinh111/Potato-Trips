import { getAiProviderRuntime } from "@/lib/ai/provider-runtime";
import type { AiProviderMessage } from "@/lib/ai/types";
import {
  type AiGeneratedItinerary,
  aiGeneratedItinerarySchema,
  normalizeGeneratedItinerary,
  type PersistedItinerary,
  type PlanningBrief,
} from "@/lib/planning-sessions/types";

const INITIAL_ITINERARY_SYSTEM_INSTRUCTIONS = `You are generating an initial travel itinerary from a confirmed planning brief.
Rules:
- Use only planning-brief facts and practical assumptions compatible with user constraints.
- Keep suggestions realistic for trip length and destination scope.
- Do not claim verification for maps/addresses/opening hours/ratings/photos/flights/fares/live inventory.
- Include major transport items only where useful at planning level.
- Return structured JSON only, matching the schema exactly.
- Keep item descriptions useful and concise.`;

export async function generateInitialItineraryDraft(input: {
  planningBrief: PlanningBrief;
}): Promise<AiGeneratedItinerary> {
  const provider = getAiProviderRuntime();

  const messages: AiProviderMessage[] = [
    {
      role: "user",
      content: `Confirmed planning brief JSON:\n${JSON.stringify(input.planningBrief)}`,
    },
  ];

  const result = await provider.generateStructured({
    systemInstructions: INITIAL_ITINERARY_SYSTEM_INSTRUCTIONS,
    messages,
    outputSchema: aiGeneratedItinerarySchema,
  });

  return aiGeneratedItinerarySchema.parse(result.output);
}

export function validateAndNormalizeGeneratedItinerary(input: {
  itinerary: AiGeneratedItinerary;
}): PersistedItinerary {
  const aiItinerary = aiGeneratedItinerarySchema.parse(input.itinerary);

  return normalizeGeneratedItinerary(aiItinerary);
}

export async function generateInitialItinerary(input: {
  planningBrief: PlanningBrief;
}): Promise<PersistedItinerary> {
  const draft = await generateInitialItineraryDraft(input);

  return validateAndNormalizeGeneratedItinerary({ itinerary: draft });
}
