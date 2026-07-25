import { logger, schemaTask } from "@trigger.dev/sdk";
import { z } from "zod";

import { generateInitialItinerary } from "@/lib/planning-sessions/generation";
import {
  failPlanningSessionGeneration,
  findPlanningSessionById,
  PlanningSessionInvalidStateError,
  setPlanningSessionGenerationPhase,
  completePlanningSessionGeneration,
} from "@/lib/planning-sessions/repository";

const initialItineraryGenerationPayloadSchema = z.object({
  sessionId: z.string().trim().min(1),
});

export const initialItineraryGenerationTask = schemaTask({
  id: "initial-itinerary-generation",
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

    if (session.planningBrief === null) {
      throw new PlanningSessionInvalidStateError(
        "Planning brief is required for itinerary generation.",
      );
    }

    try {
      await setPlanningSessionGenerationPhase({
        sessionId: payload.sessionId,
        phase: "GENERATING_ITINERARY",
      });

      const itinerary = await generateInitialItinerary({
        planningBrief: session.planningBrief,
      });

      await setPlanningSessionGenerationPhase({
        sessionId: payload.sessionId,
        phase: "CHECKING_PLAN",
      });

      await setPlanningSessionGenerationPhase({
        sessionId: payload.sessionId,
        phase: "SAVING_ITINERARY",
      });

      await completePlanningSessionGeneration({
        sessionId: payload.sessionId,
        itinerary,
      });

      logger.info("Initial itinerary generation completed", {
        sessionId: payload.sessionId,
      });

      return {
        ok: true as const,
        sessionId: payload.sessionId,
      };
    } catch (error) {
      await failPlanningSessionGeneration({
        sessionId: payload.sessionId,
        errorMessage: "Itinerary generation failed. Please retry.",
      });

      throw error;
    }
  },
});
