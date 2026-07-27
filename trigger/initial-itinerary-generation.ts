import { logger, schemaTask } from "@trigger.dev/sdk";
import { z } from "zod";

import { PLANNING_SESSION_GENERATION_QUEUE_NAME } from "@/lib/planning-sessions/constants";
import {
  generateInitialItineraryDraft,
  validateAndNormalizeGeneratedItinerary,
} from "@/lib/planning-sessions/generation";
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

      await setPlanningSessionGenerationPhase({
        sessionId: payload.sessionId,
        generationAttempt: payload.generationAttempt,
        phase: "SAVING_ITINERARY",
      });

      await completePlanningSessionGeneration({
        sessionId: payload.sessionId,
        generationAttempt: payload.generationAttempt,
        itinerary,
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
