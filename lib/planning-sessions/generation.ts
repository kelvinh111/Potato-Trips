import { getAiProviderRuntime } from "@/lib/ai/provider-runtime";
import type { AiProviderMessage } from "@/lib/ai/types";
import { z } from "zod";
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
- For each itinerary item, set placeSearchQuery to a concise Google-friendly query only if the item is one specific real-world venue/place/station/airport/restaurant/lodging.
- Keep placeSearchQuery null for generic activities, area-level meal ideas, notes, and non-place transport guidance.
- Return structured JSON only, matching the schema exactly.
- Return exactly the required number of ordered day objects; do not combine days and do not omit days.
- Keep item descriptions useful and concise.`;

export async function generateInitialItineraryDraft(input: {
  planningBrief: PlanningBrief;
}): Promise<AiGeneratedItinerary> {
  const provider = getAiProviderRuntime();
  const expectedTripLengthDays = parseExpectedTripLengthDays(
    input.planningBrief.tripLengthDays,
  );
  const exactLengthOutputSchema = buildExactLengthAiItinerarySchema(
    expectedTripLengthDays,
  );

  const messages: AiProviderMessage[] = [
    {
      role: "user",
      content: `Confirmed planning brief JSON:\n${JSON.stringify(input.planningBrief)}\n\nGeneration contract:\n- You must return exactly ${expectedTripLengthDays} day objects in order.\n- Do not combine multiple days into one day object.\n- Do not omit any day.`,
    },
  ];

  const result = await provider.generateStructured({
    systemInstructions: INITIAL_ITINERARY_SYSTEM_INSTRUCTIONS,
    messages,
    outputSchema: exactLengthOutputSchema,
  });

  return exactLengthOutputSchema.parse(result.output);
}

export function validateAndNormalizeGeneratedItinerary(input: {
  itinerary: AiGeneratedItinerary;
  expectedTripLengthDays: number | null | undefined;
}): PersistedItinerary {
  const aiItinerary = aiGeneratedItinerarySchema.parse(input.itinerary);
  const expectedTripLengthDays = parseExpectedTripLengthDays(
    input.expectedTripLengthDays,
  );

  if (aiItinerary.days.length !== expectedTripLengthDays) {
    throw new Error(
      `Generated itinerary day count mismatch. Expected ${expectedTripLengthDays} days but received ${aiItinerary.days.length}.`,
    );
  }

  return normalizeGeneratedItinerary(aiItinerary);
}

export async function generateInitialItinerary(input: {
  planningBrief: PlanningBrief;
}): Promise<PersistedItinerary> {
  const draft = await generateInitialItineraryDraft(input);

  return validateAndNormalizeGeneratedItinerary({
    itinerary: draft,
    expectedTripLengthDays: input.planningBrief.tripLengthDays,
  });
}

function parseExpectedTripLengthDays(value: number | null | undefined): number {
  if (
    typeof value !== "number" ||
    !Number.isInteger(value) ||
    value < 1 ||
    value > 14
  ) {
    throw new Error(
      "Expected trip length is required and must be an integer between 1 and 14 days.",
    );
  }

  return value;
}

function buildExactLengthAiItinerarySchema(expectedTripLengthDays: number) {
  return aiGeneratedItinerarySchema.extend({
    days: aiGeneratedItinerarySchema.shape.days.length(expectedTripLengthDays),
  }) as z.ZodType<AiGeneratedItinerary>;
}
