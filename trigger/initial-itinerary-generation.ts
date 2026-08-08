import { logger, schemaTask } from "@trigger.dev/sdk";
import { z } from "zod";

import { searchGooglePlaceByText } from "@/lib/maps/google-places-server";
import { PLANNING_SESSION_GENERATION_QUEUE_NAME } from "@/lib/planning-sessions/constants";
import {
  generateInitialItineraryDraft,
  validateAndNormalizeGeneratedItinerary,
} from "@/lib/planning-sessions/generation";
import { resolveGeneratedItineraryPlaces } from "@/lib/planning-sessions/generated-place-resolution";
import {
  failPlanningSessionGeneration,
  findPlanningSessionById,
  PlanningSessionInvalidStateError,
  setPlanningSessionGenerationPhase,
  completePlanningSessionGeneration,
} from "@/lib/planning-sessions/repository";

const initialItineraryGenerationPayloadSchema = z.object({
  sessionId: z.string().trim().min(1),
  generationAttempt: z.number().int().min(1),
});

export const initialItineraryGenerationTask = schemaTask({
  id: "initial-itinerary-generation",
  retry: { maxAttempts: 1 },
  queue: {
    name: PLANNING_SESSION_GENERATION_QUEUE_NAME,
  },
  schema: initialItineraryGenerationPayloadSchema,
  run: async (payload) => {
    const session = await findPlanningSessionById(payload.sessionId);

    if (!session) {
      throw new PlanningSessionInvalidStateError("Planning session not found.");
    }

    if (session.status !== "GENERATING") {
      throw new PlanningSessionInvalidStateError(
        "Planning session is not in generating state.",
      );
    }

    if (session.generationAttempts !== payload.generationAttempt) {
      throw new PlanningSessionInvalidStateError(
        "Planning session generation attempt does not match task payload.",
      );
    }

    if (session.planningBrief === null) {
      throw new PlanningSessionInvalidStateError(
        "Planning brief is required for itinerary generation.",
      );
    }

    try {
      await setPlanningSessionGenerationPhase({
        sessionId: payload.sessionId,
        generationAttempt: payload.generationAttempt,
        phase: "GENERATING_ITINERARY",
      });

      const draftItinerary = await generateInitialItineraryDraft({
        planningBrief: session.planningBrief,
      });

      await setPlanningSessionGenerationPhase({
        sessionId: payload.sessionId,
        generationAttempt: payload.generationAttempt,
        phase: "CHECKING_PLAN",
      });

      const itinerary = validateAndNormalizeGeneratedItinerary({
        itinerary: draftItinerary,
        expectedTripLengthDays: session.planningBrief.tripLengthDays,
      });

      const resolution = await resolveGeneratedItineraryPlaces({
        itinerary,
        sessionExpiresAt: session.expiresAt,
        resolveQuery: async (query) => {
          return searchGooglePlaceByText({ query });
        },
      });

      logger.info("Generated place resolution summary", {
        sessionId: payload.sessionId,
        generationAttempt: payload.generationAttempt,
        attempted: resolution.summary.attempted,
        verified: resolution.summary.verified,
        unverified: resolution.summary.unverified,
        skipped: resolution.summary.skipped,
        failed: resolution.summary.failed,
      });

      await setPlanningSessionGenerationPhase({
        sessionId: payload.sessionId,
        generationAttempt: payload.generationAttempt,
        phase: "SAVING_ITINERARY",
      });

      await completePlanningSessionGeneration({
        sessionId: payload.sessionId,
        generationAttempt: payload.generationAttempt,
        itinerary: resolution.itinerary,
      });

      logger.info("Initial itinerary generation completed", {
        sessionId: payload.sessionId,
        generationAttempt: payload.generationAttempt,
      });

      return {
        ok: true as const,
        sessionId: payload.sessionId,
        generationAttempt: payload.generationAttempt,
      };
    } catch (error) {
      await failPlanningSessionGeneration({
        sessionId: payload.sessionId,
        generationAttempt: payload.generationAttempt,
        errorMessage: "Itinerary generation failed. Please retry.",
      });

      throw error;
    }
  },
});
